import { getCoderByCoinType, coinNameToTypeMap } from '@ensdomains/address-encoder';
import { hexToBytes, bytesToHex, toBytes } from '@noble/hashes/utils';
import { ens_normalize } from '@adraffy/ens-normalize';
import { Base64URL, CID, Base32, uvarint, Base64 } from '@adraffy/cid';
import { keccak_256 } from '@noble/hashes/sha3';
import { eth as eth$1 } from '@ensdomains/address-encoder/coins';

function utf8_from_bytes(v) {
	return new TextDecoder().decode(v);
}

function bytes_from_phex(x) {
	if (x instanceof Uint8Array) {
		return x;
	} else if (Array.isArray(x)) {
		return Uint8Array.from(x);
	} else if (maybe_phex(x)) {
		return hexToBytes(x.slice(2));
	}
	throw error_with('expected 0x-string', {value: x});
}
function phex_from_bytes(v) {
	return '0x' + bytesToHex(v);
}

function bytes32_from(x) {
	if (x instanceof Uint8Array) {
		if (x.length !== 32) throw error_with('expected 32-bytes', {value: x});
		return x;
	}
	return hexToBytes(BigInt(x).toString(16).padStart(64, '0').slice(-64));
}

function split_norm(s) {
	return s ? ens_normalize(s).split('.') : [];
}

function maybe_phex(s) {
	return typeof s === 'string' && /^0x/i.test(s);
}

function error_with(message, options, cause) {
	let error;
	if (cause) {
		error = new Error(message, {cause});
		if (!error.cause) error.cause = cause;
	} else {
		error = new Error(message);
	}
	return Object.assign(error, options);
}

function array_equals(a, b) {
	if (a === b) return true;
	let n = a.length;
	let c = b.length === n;
	for (let i = 0; !c && i < n; i++) c = a[i] === b[i];
	return c;
}

const cache = new Map();

const TYPE_ETH = 60;
const MSB = 0x80000000;

const eth0 = getCoderByCoinType(TYPE_ETH).decode;
function eth(s) {
	if (typeof s === 'string') {
		let v = bytes_from_phex(s);
		if (v.length == 20) {
			let rest = s.slice(2);
			if (rest === rest.toLowerCase() || rest === rest.toUpperCase()) {
				return v;
			}
		}
	}
	return eth0(s);
}

// TODO: should this be BigInt?
class Coin {
	static fromType(type) {
		let coin = cache.get(type);
		if (!coin) {
			let {name, encode, decode} = getCoderByCoinType(type);
			if (decode === eth0) decode = eth;
			coin = Object.assign(new Coin, {type, name, encode, decode});
			cache.set(type, coin);
		}
		return coin;
	}
	static from(query) {
		if (typeof query === 'number') {
			return this.fromType(query);
		} else if (typeof query === 'string') {
			query = {name: query};
		}
		let {type, name, chain} = query;
		if (name) {
			type = coinNameToTypeMap[name];
		} else if (typeof chain === 'number') {
			if (chain === 1) {
				type = TYPE_ETH;
			} else {
				type = chain + MSB;
			}
		}
		if (typeof type !== 'number') {
			throw error_with('unable to derive coin type', query);
		}
		return this.fromType(type);
	}
	get chain() {
		let {type} = this;
		if (type === TYPE_ETH) {
			return 1;
		} else if (type & MSB) {
			return type & (MSB-1);
		}
	}
}

class Address {
	static from(x, s) {
		let coin = Coin.from(x);
		return new this(coin, coin.decode(s));
	}
	static fromParts(type, x) {
		let coin = Coin.fromType(type);
		let v = bytes_from_phex(x);
		coin.encode(v); // validate
		return new this(coin, v);
	}
	constructor(coin, bytes) {
		this.coin = coin;
		this.bytes = bytes;
	}
	get type() { return this.coin.type; }
	get name() { return this.coin.name; }
	toObject() {
		let {type, name, bytes} = this;
		return {type, name, value: this.toString(), bytes};
	}
	toPhex() {
		return phex_from_bytes(this.bytes);
	}
	toString() {
		let {coin, bytes} = this;
		return coin.encode(bytes);
	}
	toJSON() {
		return this.toString();
	}
}

const SCHEME_SEPARATOR = '://';
const KEY_CONTENTHASH = 'contenthash';
const KEY_ONION = 'onion';
const SHORT_DATAURL_KEYS = [
	{
		mime: 'text/plain',
		key: 'text', 
		decode: utf8_from_bytes,
		encode: toBytes
	},
	{
		mime: 'text/html',
		key: 'html', 
		decode: utf8_from_bytes,
		encode: toBytes
	},
	{
		mime: 'application/json',
		key: 'json',
		decode: v => JSON.parse(utf8_from_bytes(v)),
		encode: x => toBytes(JSON.stringify(x))
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
	gateway: ({hash}) => `https://${hash}.onion.to`
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
const Onion = {
	...ONION_PROTO,
	codec: 0x1BD,
	toHash(v) {
		return Base32.encode(this.toObject(v).pubkey);
	},
	toObject(v) {
		return {
			pubkey: v.subarray(0, 32),
			checksum: v.subarray(32, 34),
			version: v[34]
		};
	},
	fromPubkey(x, version = 3) {
		let pubkey = bytes_from_phex(x);
		if (pubkey.length !== 32) throw error_with(`expected 32-byte pubkey`, {pubkey});
		let v = new Uint8Array(48); // 15 + 32 + 1
		v.set(toBytes(ONION_SUFFIX + ' checksum'));
		v.set(pubkey, 15);
		v.set(47, version);
		let bytes = new Uint8Array(35);
		bytes.set(pubkey);
		bytes.set(32, keccak_256(v).subarray(0, 2));
		bytes[34] = version;
		return bytes;
	}
};

// https://datatracker.ietf.org/doc/html/rfc1738
const GenericURL = {
	codec: 0x12346,
	name: 'URL',
	toEntry(v) {
		return [KEY_CONTENTHASH, this.toURL(v)];
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
const DataURL = {
	codec: 0x12345,
	scheme: 'data',
	name: 'DataURL',
	toEntry(v) {
		let [mime, data] = decode_mime_data(v);
		let short = SHORT_DATAURL_KEYS.find(x => x.mime === mime);
		if (short) {
			return [short.key, short.decode(data)];
		}
		return [KEY_CONTENTHASH, url_from_mime_data(mime, data)];
	},
	toObject(v) {
		let [mime, data] = decode_mime_data(v);
		let short = SHORT_DATAURL_KEYS.find(x => x.mime === mime);
		if (short) {
			return {[short.key]: short.decode(data)};
		}
		return {mime, data};
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
	toObject(v)  { return CID.from(v); }
}
class CodedHash extends SchemeHash {
	parseHash(s) {
		let v = this.coder.decode(s);
		this.validate(v);
		return v;
	}
	toHash(v)   { return this.coder.encode(v); }
	toObject(v) { return {hash: this.toHash(v)}; }
}

const IPFS = Object.assign(new CIDHash, {
	codec: 0xE3,
	name: 'IPFS',
	scheme: 'ipfs',
	gateway: ({hash}) => `https://cloudflare-ipfs.com/ipfs/${hash}`,
});

const IPNS = Object.assign(new CIDHash, {
	codec: 0xE5,
	name: 'IPNS',
	scheme: 'ipns',
	gateway: ({hash}) => `https://${hash}.ipfs2.eth.limo`,
});

const Swarm = Object.assign(new CIDHash, {
	codec: 0xE4,
	name: 'Swarm',
	scheme: 'bzz',
	gateway: ({hash}) => `https://${hash}.bzz.link`
});

const Arweave = Object.assign(new CodedHash, {
	codec: 0xB29910,
	name: 'Arweave',
	scheme: 'ar',
	gateway: ({hash}) => `https://arweave.net/${hash}`,
	coder: Base64URL,
	validate(v) { 
		if (v.length != 32) throw new Error('expected 32 bytes');
	}
});

const SPECS = [
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

function encode_contenthash(codec, data) {
	let len = [];
	uvarint.write(len, codec);
	let v = new Uint8Array(len.length + data.length);
	v.set(len);
	v.set(data, len.length);
	return v;
}
class ContentHash {
	static fromParts(spec, data) {
		return new this(encode_contenthash(spec.codec ?? spec, data));
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
			if (!array_equals(data, expect)) throw error_with('invalid checksum', {hash, data, expect});
			return this.fromParts(spec, data);
		}
		throw error_with('invalid hash', {hash, data});
	}
	static fromEntry(key, value) {
		let spec = SCHEME_MAP.get(key);
		if (spec) {
			return this.fromParts(spec, spec.parseHash(value));
		}
		let short = SHORT_DATAURL_KEYS.find(x => x.key === key);
		if (short) {
			return this.fromParts(DataURL, encode_mime_data(short.mime, short.encode(value)));
		}
		if (key.includes('/')) {
			return this.fromParts(DataURL, encode_mime_data(key, toBytes(value)));
		}
		if (key === KEY_ONION) {
			return this.fromOnion(value);
		} 
		// the key didn't hint
		if (value instanceof ContentHash) {
			return value;
		} else if (typeof value === 'string') {
			if (maybe_phex(value)) {
				return this.fromBytes(value);
			} else {
				return this.fromURL(value);
			}
		// } else {
		// 	return this.fromEntry(value.type, value.hash);
		}
		throw error_with('unknown contenthash', {key, value});
	}
	static fromBytes(x) {
		let bytes = bytes_from_phex(x);
		let [codec, pos] = uvarint.read(bytes);
		let spec = SPECS.find(x => x.codec === codec);
		if (!spec) throw error_with(`unknown contenthash codec: ${codec}`, {codec, bytes});
		return this.fromURL(spec.toURL(bytes.subarray(pos)));
	}
	static fromURL(url) {
		let {scheme, authority} = split_url(url);
		let spec = SCHEME_MAP.get(scheme);
		if (spec) {
			return this.fromParts(spec, spec.parseHash(authority));
		}
		if (scheme === 'http' && authority.endsWith(ONION_SUFFIX)) {
			return this.fromOnion(authority.slice(0, -ONION_SUFFIX.length));
		}
		return this.fromParts(GenericURL, toBytes(url));
	}
	constructor(bytes) {
		this.bytes = bytes;
	}
	get spec() { return this.toParts()[0]; }
	get data() { return this.toParts()[1]; }
	toParts() {
		let {bytes} = this;
		let [codec, pos] = uvarint.read(bytes);
		let spec = CODEC_MAP.get(codec);
		let data = bytes.subarray(pos);
		return [spec, data];
	}
	toHash() { 
		let [spec, data] = this.toParts();
		return spec.toHash(data); 
	}
	toObject() {
		let [spec, data] = this.toParts();
		return spec.toObject(data); 
	}
	toEntry() { 
		let [spec, data] = this.toParts();
		return spec.toEntry(data);
	}
	toURL() { 
		let [spec, data] = this.toParts();
		return spec.toURL(data); 
	}
	toGatewayURL() {
		let [spec, data] = this.toParts();
		return spec.gateway?.({spec, data, hash: spec.toHash(data)}) ?? spec.toURL(data);
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
	url = url.toString();
	let pos = url.indexOf(SCHEME_SEPARATOR);
	if (!pos) throw error_with(`expected scheme separator`, {url});
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

// https://github.com/ethereum/EIPs/pull/619/files/9977cf4c2646b46f367e458a939888f93499990c#diff-5692e3f9c0bdb6bf2dbacbdec7059b3d70fcec8a12da584e598dff53e020cf93

class Pubkey {
	static fromXY(x, y) {
		let self = new this();
		self.x = x;
		self.y = y;
		return self;
	}
	static from(value) {
		if (!value) return new this();
		try {
			if (value instanceof Uint8Array) {
				return new this(value);
			} else if (typeof value === 'string') {
				return new this(bytes_from_phex(value));
			} else if (typeof value === 'object') {
				return this.fromXY(value.x, value.y);
			} 
			throw new Error('unknown value');
		} catch (err) {
			throw error_with('invalid pubkey format', {value}, err);
		}
	}
	constructor(bytes) {
		if (!bytes) {
			bytes = new Uint8Array(64);
		} else if (bytes.length != 64) {
			throw error_with('expected 64 bytes', {bytes});
		}
		this.bytes = bytes;
	}
	set x(x) { this.bytes.set(bytes32_from(x), 0); }
	set y(x) { this.bytes.set(bytes32_from(x), 32); }
	get x() { return this.bytes.subarray(0, 32); }
	get y() { return this.bytes.subarray(32); }
	get address() { return eth$1.encode(keccak_256(this.bytes).subarray(-20)); }
	toObject() {
		let {x, y, address} = this;
		return {x, y, address};
	}
	toJSON() {
		return {
			x: phex_from_bytes(this.x),
			y: phex_from_bytes(this.y)
		};
	}
}

const PREFIX_COIN = '$';
const PREFIX_MAGIC = '#';

class Record extends Map {
	static from(json) {
		let self = new this();
		for (let [k, v] of Object.entries(json)) {
			self.put(k, v);
		}
		return self;
	}
	put(key, x) {
		// json:                  | getter:       | storage:
		// {"name": "Raffy"}      | text(key)     | {key: string} 
		// {"$eth": "0x5105...}   | addr(type)    | {${coin.name}: Address}
		// {"#ipfs": "Qm..."}     | contenthash() | {Record.CONTENTHASH: Contenthash}
		// {"#pubkey": {x, y}}    | pubkey()      | {Record.PUBKEY: Pubkey}
		// {"#name": "raffy.eth"} | name()        | {Record.NAME: string}
		try {
			let k = key;
			if (k.startsWith(PREFIX_COIN)) {
				x = Address.from(k.slice(PREFIX_COIN.length), x);
				k = x.type;
			} else if (k === Record.PUBKEY) {
				x = Pubkey.from(x);
			} else if (k === Record.NAME) {
				// unmodified
			} else if (k.startsWith(PREFIX_MAGIC)) {
				x = ContentHash.fromEntry(k.slice(PREFIX_MAGIC.length), x);
				k = Record.CONTENTHASH;
			}
			this.set(k, x);
		} catch (err) {
			throw error_with(`Storing "${key}": ${err.message}`, {key}, err);
		}
	}
	text(key) {
		return this.get(key);
	}
	addr(type) {
		return this.get(type)?.bytes;
	}
	contenthash() {
		return this.get(Record.CONTENTHASH)?.bytes;
	}
	pubkey() {
		return this.get(Record.PUBKEY)?.bytes;
	}
	name() {
		return this.get(Record.NAME);
	}
	toEntries() {
		return [...this].map(x => {
			let [k, v] = x;
			if (v instanceof Address) {
				return [PREFIX_COIN + v.coin.name, v.toObject()];
			}
			switch (k) {
				case Record.CONTENTHASH: {
					[k, v] = v.toEntry();
					return [PREFIX_MAGIC + k, v];
				}
				case Record.PUBKEY: return [k, v.toObject()];
			}
			return x;
		});
	}
	toObject() {
		return Object.fromEntries(this.toEntries());
	}
	toJSONEntries() {
		return [...this].map(x => {
			let [k, v] = x;
			if (v instanceof Address) {
				return [PREFIX_COIN + v.coin.name, v.toJSON()];
			}
			switch (k) {
				case Record.CONTENTHASH: return [k, v.toJSON()];
				case Record.PUBKEY: return [k, v.toJSON()];
			}
			return x;
		});
	}
	toJSON() {
		return Object.fromEntries(this.toJSONEntries());
	}
}
for (let x of ['CONTENTHASH', 'PUBKEY', 'NAME']) {
	Object.defineProperty(Record, x, {value: PREFIX_MAGIC + x.toLowerCase()});
}

const LABEL_SELF = '.';

class Node extends Map {
	static root(name) {
		return new this(`[${name || 'root'}]`);
	}
	constructor(label, parent) {
		super();
		this.label = label;
		this.parent = parent || null;
		this.record = null;
	}
	// get node "a" from "a.b.c" or null
	// find("") is identity
	find(name) {
		return split_norm(name).reduceRight((x, s) => x?.get(s), this);
	}
	// ensures the nodes for "a.b.c" exist and returns "a"
	create(name) {
		return split_norm(name).reduceRight((x, s) => x.ensureChild(s), this);
	}
	// gets or creates a subnode of this node
	ensureChild(label) {
		let node = this.get(label);
		if (!node) {
			node = new Node(label, this);
			this.set(label, node);
		}
		return node;
	}
	importJSON(json) {
		try {
			if (typeof json !== 'object' || Array.isArray(json)) throw new Error('expected object');
			let record = json[LABEL_SELF];
			this.record = Record.from(record || json);
			if (record) {
				for (let [ks, v] of Object.entries(json)) {
					ks = ks.trim();
					if (!ks || ks === LABEL_SELF) continue;
					for (let k of ks.split(/\s+/)) {
						this.create(k).importJSON(v);
					}
				}
			}
		} catch (err) {
			throw error_with(`Importing "${this.name}": ${err.message}`, {json}, err);
		}
	}
	toJSON() {
		if (this.record && !this.size) {
			return this.record.toJSON();
		}
		let json = {};
		if (this.record) {
			json[LABEL_SELF] = this.record.toJSON();
		}
		for (let [k, v] of this) {
			json[k] = v.toJSON();
		}
		return json;
	}
	*records() {
		let {record} = this;
		if (record) yield record;
		for (let x of this.values()) {
			yield* x.records();
		}
	}
	*nodes() {
		yield this;
		for (let x of this.values()) {
			yield* x.nodes();
		}
	}
	get name() {
		if (!this.parent) return this.label;
		let v = [];
		for (let node = this; node.parent; node = node.parent) {
			v.push(node.label);
		}
		return v.join('.');
	}
	scan(fn, level = 0) {
		fn(this, level++);
		for (let x of this.values()) {
			x.scan(fn, level);
		}
	}
	print() {
		this.scan((x, n) => {
			let line = '  '.repeat(n) + x.label;
			if (x.record) line += '*';          // label* => this node has a record
			if (x.size) line += ` (${x.size})`; // (#) => this node has subdomains
			console.log(line);
		});
	}
}

export { Address, Coin, ContentHash, Node, Record };
