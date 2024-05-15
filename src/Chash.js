import {error_with, array_equals, utf8_from_bytes, is_string, phex_from_bytes, bytes_from, try_coerce_bytes} from './utils.js';
import {CID, uvarint, Base64URL, Base64, Base32} from '@adraffy/cid';
import {sha3_256} from '@noble/hashes/sha3';
import {utf8ToBytes, toBytes} from '@noble/hashes/utils';

const SCHEME_SEPARATOR = '://';
const KEY_ONION = 'onion';
const SHORT_DATAURL_KEYS = [
	{
		mime: 'text/plain',
		key: 'text', 
		decode: utf8_from_bytes,
		encode: utf8ToBytes
	},
	{
		mime: 'text/html',
		key: 'html', 
		decode: utf8_from_bytes,
		encode: utf8ToBytes
	},
	{
		mime: 'application/json',
		key: 'json',
		decode: v => JSON.parse(utf8_from_bytes(v)),
		encode: x => utf8ToBytes(JSON.stringify(x))
	}
];

const ONION_SUFFIX = `.onion`;
const ONION_PROTO = {
	name: 'Onion',
	toEntry(v) {
		return [KEY_ONION, this.toHash(v)];
	},
	toURL(v) {
		return `http://${this.toHash(v)}${ONION_SUFFIX}`; 
	},
	gateway: hash => `https://${hash}.onion.to`
};
const Onion_Legacy = {
	...ONION_PROTO,
	codec: 0x1BC,
	legacy: true,
	toHash(v) {
		return Base32.encode(v);
	},
	toObject(v) {
		return {hash: v};
	}
};
export const Onion = {
	...ONION_PROTO,
	codec: 0x1BD,
	toPubkey(v) {
		return v.subarray(0, 32);
	},
	toHash(v) {
		return Base32.encode(this.toPubkey(v));
	},
	toObject(v) {
		return {
			pubkey: this.toPubkey(v),
			checksum: v.subarray(32, 34),
			version: v[34]
		};
	},
	fromPubkey(x, version = 3) {
		let pubkey = bytes_from(x, false);
		if (pubkey.length !== 32) throw error_with(`expected 32-byte pubkey`, {pubkey});
		let v = new Uint8Array(48); // 15 + 32 + 1
		v.set(utf8ToBytes(ONION_SUFFIX + ' checksum'));
		v.set(pubkey, 15);
		v[47] = version;
		let bytes = new Uint8Array(35);
		bytes.set(pubkey);
		bytes.set(sha3_256(v).subarray(0, 2), 32);
		bytes[34] = version;
		return bytes;
	}
}

// https://datatracker.ietf.org/doc/html/rfc1738
export const GenericURL = {
	codec: 0x12346,
	name: 'URL',
	toEntry(v) {
		return ['', this.toURL(v)];
	},
	toHash(v) {
		return this.toURL(v);
	},
	toURL(v) {
		return utf8_from_bytes(v);
	},
	toObject(v) {
		let url = this.toURL(v);
		try {
			return {...new URL(url)}
		} catch (err) {
			return split_url(url);
		}
	}
};

function encode_mime_data(mime, data) {
	mime = toBytes(mime);
	let len = [];
	let pos = uvarint.write(len, mime.length);
	let v = new Uint8Array(pos + mime.length + data.length);
	v.set(len);
	v.set(mime, pos);
	v.set(data, pos + mime.length);
	return v;
}
function url_from_mime_data(mime, data) {
	return `data:${mime};base64,${Base64.encode(data, true)}`;
}
function decode_mime_data(v) {
	let [len, pos] = uvarint.read(v);
	let mime = utf8_from_bytes(v.subarray(pos, pos += len));
	let data = v.subarray(pos);
	return [mime, data];
}

// https://datatracker.ietf.org/doc/html/rfc2397
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/
export const DataURL = {
	codec: 0x12345,
	scheme: 'data',
	name: 'DataURL',
	toEntry(v) {
		let [mime, data] = decode_mime_data(v);
		let short = SHORT_DATAURL_KEYS.find(x => x.mime === mime);
		if (short) {
			return [short.key, short.decode(data)];
		}
		return ['', url_from_mime_data(mime, data)];
	},
	toObject(v) {
		let [mime, data] = decode_mime_data(v);
		let obj = {mime, data};
		let short = SHORT_DATAURL_KEYS.find(x => x.mime === mime);
		if (short) {
			obj.abbr = short.key;
			obj.value = short.decode(data);
		}
		return obj;
	},
	toURL(v) {
		let [mime, data] = decode_mime_data(v);
		return url_from_mime_data(mime, data);
	},
	toHash(v) {
		return this.toURL(v);
	}
};

class SchemeHash {
	toEntry(v) { return [this.scheme, this.toHash(v)]; }	
	toURL(v)   { return this.scheme + SCHEME_SEPARATOR + this.toHash(v); }
}
class CIDHash extends SchemeHash {
	parseHash(s) { return CID.from(s).bytes; }
	toHash(v)    { return CID.from(v).toString(); }
	toObject(v)  { 
		let {version, codec, hash, base} = CID.from(v);
		let cid = {version, codec};
		if (base) cid.base = base;
		cid.hash = {...hash};
		return {cid};
	}
}
class CodedHash extends SchemeHash {
	parseHash(hash) {
		try {
			let v = this.coder.decode(hash);
			this.validate(v);
			return v;
		} catch (err) {
			throw error_with('invalid hash', {hash}, err);
		}
	}
	toHash(v)   { return this.coder.encode(v); }
	toObject(v) { return {hash: this.toHash(v)}; }
}

export const IPFS = Object.assign(new CIDHash, {
	codec: 0xE3,
	name: 'IPFS',
	scheme: 'ipfs',
	gateway: hash => `https://cloudflare-ipfs.com/ipfs/${hash}`,
});

export const IPNS = Object.assign(new CIDHash, {
	codec: 0xE5,
	name: 'IPNS',
	scheme: 'ipns',
	gateway: hash => `https://${hash}.ipfs2.eth.limo`,
});

export const Swarm = Object.assign(new CIDHash, {
	codec: 0xE4,
	name: 'Swarm',
	scheme: 'bzz',
	gateway: hash => `https://${hash}.bzz.link`
});

export const Arweave = Object.assign(new CodedHash, {
	codec: 0xB29910,
	name: 'Arweave',
	scheme: 'ar',
	gateway: hash => `https://arweave.net/${hash}`,
	coder: Base64URL,
	validate(v) { 
		if (v.length != 32) throw new Error('expected 32 bytes');
	}
});

export const SPECS = [
	IPFS,
	IPNS,
	Swarm,
	Arweave,
	Onion_Legacy,
	Onion,
	DataURL,
	GenericURL
];
const CODEC_MAP = new Map(SPECS.map(x => [x.codec, x]));
const SCHEME_MAP = new Map(SPECS.filter(x => x.scheme).map(x => [x.scheme, x]));

export class Chash {
	static from(x, hint) {
		if (x instanceof Chash) {
			return new this(x.bytes.slice()); // copy
		}
		if (hint) {
			let spec = SCHEME_MAP.get(hint);
			if (spec) {
				return this.fromParts(spec, spec.parseHash(x));
			}
			let short = SHORT_DATAURL_KEYS.find(x => x.key === hint);
			if (short) {
				return this.fromParts(DataURL, encode_mime_data(short.mime, short.encode(x)));
			}
			if (hint.includes('/')) {
				return this.fromParts(DataURL, encode_mime_data(hint, toBytes(x)));
			}
			if (hint === KEY_ONION) {
				return this.fromOnion(x);
			}
		}
		let v = try_coerce_bytes(x);
		if (v !== x) {
			return this.fromBytes(v);
		} else if (is_string(x)) {
			return this.fromURL(x);
		}
		throw error_with('unknown contenthash', {hint, value: x});
	}
	static fromParts(codec, data) {
		if (!Number.isInteger(codec)) {
			if (!codec?.codec) throw error_with('expected codec', {codec});
			codec = codec.codec;
		}
		data = bytes_from(data, true);
		let len = [];
		uvarint.write(len, codec);
		let v = new Uint8Array(len.length + data.length);
		v.set(len);
		v.set(data, len.length);
		return new this(v);
	}
	static fromOnion(hash) {
		// https://github.com/torproject/torspec/blob/main/rend-spec-v3.txt
		let data = Base32.decode(hash); // must decode, throws
		if (data.length === 10) { // 16 char
			return this.fromParts(Onion_Legacy, data);
		} else if (data.length === 35) { // 56 char
			let spec = Onion;
			let {pubkey} = spec.toObject(data);
			let expect = spec.fromPubkey(pubkey);
			if (!array_equals(data, expect)) throw error_with('invalid onion checksum', {hash, data, expect});
			return this.fromParts(spec, data);
		}
		throw error_with('invalid onion hash', {hash, data});
	}
	static fromBytes(x) {
		let bytes = bytes_from(x, false);
		let codec, pos;
		try {
			[codec, pos] = uvarint.read(bytes);
		} catch (err) {
			throw error_with('invalid contenthash', {bytes});
		}
		let spec = SPECS.find(x => x.codec === codec);
		if (!spec) throw error_with('unknown contenthash codec', {codec, bytes});
		return this.fromURL(spec.toURL(bytes.subarray(pos)));
	}
	static fromURL(url) {
		let {scheme, authority} = split_url(url.toString());
		let spec = SCHEME_MAP.get(scheme);
		if (spec) {
			return this.fromParts(spec, spec.parseHash(authority));
		}
		if (scheme === 'http' && authority.endsWith(ONION_SUFFIX)) {
			return this.fromOnion(authority.slice(0, -ONION_SUFFIX.length));
		}
		return this.fromParts(GenericURL, utf8ToBytes(url));
	}
	constructor(bytes) {
		this.bytes = bytes;
	}
	get codec() {
		return uvarint.read(this.bytes)[0];
	}
	get spec() { 
		return CODEC_MAP.get(this.codec);
	}
	get data() {
		return this._data.slice();
	}
	get _data() {
		let v = this.bytes;
		return v.subarray(uvarint.read(v)[1]);
	}
	toHash() {
		return this.spec.toHash(this._data); 
	}
	toObject() {
		let {spec, _data: v} = this;
		let {codec, name} = spec;
		return {
			protocol: {codec, name},
			url: spec.toURL(v),
			...spec.toObject(v)
		};
	}
	toEntry() {
		return this.spec.toEntry(this._data);
	}
	toURL() { 
		return this.spec.toURL(this._data); 
	}
	toGatewayURL() {
		let {spec, _data: v} = this;
		return spec.gateway?.(spec.toHash(v), spec, v) ?? spec.toURL(v);
	}
	toPhex() {
		return phex_from_bytes(this.bytes); 
	}
	toJSON() { 
		return this.toURL(); 
	}
}

// simple parsing since URL varies between browsers
function split_url(url) {
	let pos = url.indexOf(SCHEME_SEPARATOR);
	if (pos === -1) throw error_with('expected scheme separator', {url});
	let scheme = url.slice(0, pos);	
	let authority = url.slice(pos + SCHEME_SEPARATOR.length);
	let rest = '';
	pos = authority.indexOf('/');
	if (pos >= 0) {
		rest = authority.slice(pos);
		authority = authority.slice(0, pos);
	}
	return {scheme, authority, rest};
}

// freezing
Object.freeze(SPECS);
SPECS.forEach(Object.freeze);
