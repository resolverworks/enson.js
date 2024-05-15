'use strict';

var addressEncoder = require('@ensdomains/address-encoder');
var utils = require('@noble/hashes/utils');
var sha3 = require('@noble/hashes/sha3');
var cid = require('@adraffy/cid');
var ensNormalize = require('@adraffy/ens-normalize');

function namesplit(x) {
	return Array.isArray(x) ? x : x ? x.split('.') : [];
}

function namehash(name) {
	return namesplit(name).reduceRight((v, x) => {
		v.set(sha3.keccak_256(x), 32);
		v.set(sha3.keccak_256(v), 0);
		return v;
	}, new Uint8Array(64)).slice(0, 32);
}

function dns_encoded(name) {
	let labels = namesplit(name);
	let m = labels.map(label => {
		let v = utils.utf8ToBytes(label);
		if (!v.length) throw error_with('empty label', {labels});
		if (v.length > 255) throw error_with('too long', {labels, label});
		return v;
	});
	let dns = new Uint8Array(m.reduce((a, v) => a + 1 + v.length, 1));
	let pos = 0;
	for (let v of m) {
		dns[pos++] = v.length;
		dns.set(v, pos); pos += v.length;
	}
	return dns;
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

function is_number(x) {
	return typeof x === 'number';
}
function is_string(x) {
	return typeof x === 'string';
}
function is_bigint(x) {
	return typeof x === 'bigint';
}

function is_samecase_phex(s) {
	return is_string(s) && /^0x([0-9A-F]*|[0-9a-f]*)/i.test(s);
}

function bytes_from(x, copy = true) {
	if (x instanceof Uint8Array) {
		return copy ? x.slice() : x;
	}
	let v = try_coerce_bytes(x);
	if (v !== x) return v;
	throw error_with('expected bytes-like', {value: x});
}

// always !== if successful (returns a copy)
function try_coerce_bytes(x, no_phex) {
	if (x instanceof Uint8Array) {
		return x.slice();
	} else if (Array.isArray(x)) {
		return Uint8Array.from(x);
	} else if (!no_phex && is_samecase_phex(x)) {
		return utils.hexToBytes(x.slice(2)); // throws if odd-length
	} else {
		return x;
	} 
}

function utf8_from_bytes(v) {
	return new TextDecoder().decode(v);
}

function bytes32_from(x) {
	x = try_coerce_bytes(x, true);
	if (x instanceof Uint8Array) {
		if (x.length !== 32) throw error_with('expected 32-bytes', {value: x});
		return x;
	}
	return utils.hexToBytes(BigInt(x).toString(16).padStart(64, '0').slice(-64));
}

function phex_from_bytes(v) {
	return '0x' + utils.bytesToHex(v);
}

function bigint_at(v, i) {
	return BigInt(phex_from_bytes(v.subarray(i, i + 32)));
}

function array_equals(a, b) {
	if (a === b) return true;
	let n = a.length;
	let c = b.length === n;
	for (let i = 0; c && i < n; i++) c = a[i] === b[i];
	return c;
}

const COINS = new Map();
const TYPE_ETH = 60n;
const MSB = 0x80000000n;
const PREFIX_CHAIN = 'chain:';
const PREFIX_UNKNOWN = '#';

function init() {
	if (COINS.init) return;
	COINS.init = true;
	for (let x of Object.values(addressEncoder.coinNameToTypeMap)) {
		Coin.fromType(x);
	}
}

// patch around strict parsing
const {encode: eth_encode, decode: eth_decode_checksum} = addressEncoder.getCoderByCoinType(60);
function eth_decode(s) {
	return is_samecase_phex(s) && s.length == 42 ? utils.hexToBytes(s.slice(2)) : eth_decode_checksum(s);
}

class Coin {
	static get count() { init(); return COINS.size; }
	static [Symbol.iterator]() { init(); return COINS.values(); }
	static from(x) {
		if (x instanceof this) {
			return x;
		} else if (is_string(x)) {
			return this.fromName(x);
		} else if (is_number(x) || is_bigint(x)) {
			return this.fromType(x);
		}
		let {type, name, chain} = x;
		if (type !== undefined) {
			return this.fromType(type);
		} else if (name !== undefined) {
			return this.fromName(name);
		} else {
			return this.fromChain(chain);
		}
	}
	static chain(x) {
		let type = this.type(x);
		if (type === TYPE_ETH) return 1;
		if (type & MSB) return Number(type & (MSB-1n));
	}
	static type(x) {
		if (is_bigint(x)) return x;
		if (is_number(x)) return BigInt(x);
		if (x instanceof this) return x.type;
		return this.from(x).type;
	}
	static fromType(type) {
		type = BigInt(type);
		if (type < 0) throw error_with(`invalid coin type: ${type}`, {type});
		let coin = COINS.get(type);
		if (!coin) {
			let coder;
			try {
				if (type <= Number.MAX_SAFE_INTEGER) {
					coder = addressEncoder.getCoderByCoinType(Number(type));
				}
			} catch (err) {
			}
			if (coder) {
				let {encode, decode} = coder;
				if (decode === eth_decode_checksum) decode = eth_decode; // patch
				let names = addressEncoder.coinTypeToNameMap[type];
				if (names) {
					coin = new Coin(type);
					let [name, title] = names; // TODO: remove "[LEGACY] "-prefix?
					Object.defineProperties(coin, {
						name: {value: name, enumerable: true},
						title: {value: title, enumerable: true},
						parse: {value: decode},
						format: {value: encode},
					});
					if (name.endsWith('Legacy')) coin.legacy = true; // REE
					COINS.set(type, coin); // memoize
				} else {
					coin = new UnnamedEVMCoin(type);
				}
			} else {
				coin = new UnknownCoin(type);
			}
			Object.freeze(coin);
		}
		return coin;
	}
	static fromName(name) {
		let type;
		if (name.startsWith(PREFIX_CHAIN)) {
			type = BigInt(name.slice(PREFIX_CHAIN.length)) + MSB;
		} else if (name.startsWith(PREFIX_UNKNOWN)) {
			type = BigInt(name.slice(PREFIX_UNKNOWN.length));
		} else {
			let key = name.trim().toLowerCase();
			if (key.endsWith('legacy')) key = key.slice(0, -6) + 'Legacy'; // REE
			type = addressEncoder.coinNameToTypeMap[key];
			if (!is_number(type)) throw error_with(`unknown coin: ${name}`, {name});
		}
		return this.fromType(type);
	}
	static fromChain(chain) {
		return this.fromType(chain == 1 ? TYPE_ETH : BigInt(chain) + MSB)
	}
	constructor(type) {
		this.type = type;
	}
	get chain() {
		return Coin.chain(this.type); // meh: this.constructor
	}
	toJSON() {
		return '0x' + this.type.toString(16);
	}
	toString() {
		let {type, name, title, chain} = this;
		let desc = chain ? `Chain:${chain}` : `Type:${type}`;
		return `[${name}] ${title} (${desc})`;
	}
	toObject() {
		let {type, name, title, chain} = this;
		return {type, name, title, chain};
	}
	assertValid(v) {
		if (!array_equals(this.parse(this.format(v)), v)) {
			throw new Error('roundtrip failed');
		}
	}
}

class UnnamedCoin extends Coin {
	get unnamed() { return true; }
}

class UnnamedEVMCoin extends UnnamedCoin {
	get name()  { return PREFIX_CHAIN + this.chain; }
	get title() { return 'Unknown Chain'; }
	parse(s)    { return eth_decode(s); }
	format(v)   { return eth_encode(v); }
}

class UnknownCoin extends UnnamedCoin {
	get name()  { return PREFIX_UNKNOWN + this.type; }
	get title() { return 'Unknown Coin'; }
	assertValid(v) { return v.length > 0; }
	parse(s)    { throw error_with('unknown parser', {coin: this, value: s}); }
	format(v)   { return `{${phex_from_bytes(v)}}`; } // TODO: decide what to do here
	toObject() {
		let {type, title} = this;
		return {type, title};
	}
}

const ETH = Coin.fromType(TYPE_ETH);

class Address {
 	static from(coin, value) {
		if (value === undefined) { // eth shorthand
			if (coin instanceof Address) {
				return new this(coin.coin, coin.bytes.slice()); // copy
			} 
			value = coin;
			coin = ETH;
		} else {
			coin = Coin.from(coin);
		}
		try {
			let v = try_coerce_bytes(value);
			if (v === value) {
				if (!is_string(value)) {
					throw new Error('unknown address format');
				}
				v = coin.parse(value);
			}
			coin.assertValid(v);
			return new this(coin, v);
		} catch (err) {
			throw new error_with('invalid address', {coin, value}, err);
		}
	}
	constructor(coin, bytes) {
		this.coin = coin;
		this.bytes = bytes;
	}
	get value() { 
		let {coin, bytes} = this;
		return coin.format(bytes);
	}
	toObject() {
		let {coin, bytes, value} = this;
		return {coin: coin.toObject(), value, bytes};
	}
	toPhex() {
		return phex_from_bytes(this.bytes);
	}
	toString() {
		return this.value;
	}
	toJSON() {
		return this.value;
	}
}

const SCHEME_SEPARATOR = '://';
const KEY_ONION = 'onion';
const SHORT_DATAURL_KEYS = [
	{
		mime: 'text/plain',
		key: 'text', 
		decode: utf8_from_bytes,
		encode: utils.utf8ToBytes
	},
	{
		mime: 'text/html',
		key: 'html', 
		decode: utf8_from_bytes,
		encode: utils.utf8ToBytes
	},
	{
		mime: 'application/json',
		key: 'json',
		decode: v => JSON.parse(utf8_from_bytes(v)),
		encode: x => utils.utf8ToBytes(JSON.stringify(x))
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
		return cid.Base32.encode(v);
	},
	toObject(v) {
		return {hash: v};
	}
};
const Onion = {
	...ONION_PROTO,
	codec: 0x1BD,
	toPubkey(v) {
		return v.subarray(0, 32);
	},
	toHash(v) {
		return cid.Base32.encode(this.toPubkey(v));
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
		v.set(utils.utf8ToBytes(ONION_SUFFIX + ' checksum'));
		v.set(pubkey, 15);
		v[47] = version;
		let bytes = new Uint8Array(35);
		bytes.set(pubkey);
		bytes.set(sha3.sha3_256(v).subarray(0, 2), 32);
		bytes[34] = version;
		return bytes;
	}
};

// https://datatracker.ietf.org/doc/html/rfc1738
const GenericURL = {
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
	mime = utils.toBytes(mime);
	let len = [];
	let pos = cid.uvarint.write(len, mime.length);
	let v = new Uint8Array(pos + mime.length + data.length);
	v.set(len);
	v.set(mime, pos);
	v.set(data, pos + mime.length);
	return v;
}
function url_from_mime_data(mime, data) {
	return `data:${mime};base64,${cid.Base64.encode(data, true)}`;
}
function decode_mime_data(v) {
	let [len, pos] = cid.uvarint.read(v);
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
	parseHash(s) { return cid.CID.from(s).bytes; }
	toHash(v)    { return cid.CID.from(v).toString(); }
	toObject(v)  { 
		let {version, codec, hash, base} = cid.CID.from(v);
		let cid$1 = {version, codec};
		if (base) cid$1.base = base;
		cid$1.hash = {...hash};
		return {cid: cid$1};
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

const IPFS = Object.assign(new CIDHash, {
	codec: 0xE3,
	name: 'IPFS',
	scheme: 'ipfs',
	gateway: hash => `https://cloudflare-ipfs.com/ipfs/${hash}`,
});

const IPNS = Object.assign(new CIDHash, {
	codec: 0xE5,
	name: 'IPNS',
	scheme: 'ipns',
	gateway: hash => `https://${hash}.ipfs2.eth.limo`,
});

const Swarm = Object.assign(new CIDHash, {
	codec: 0xE4,
	name: 'Swarm',
	scheme: 'bzz',
	gateway: hash => `https://${hash}.bzz.link`
});

const Arweave = Object.assign(new CodedHash, {
	codec: 0xB29910,
	name: 'Arweave',
	scheme: 'ar',
	gateway: hash => `https://arweave.net/${hash}`,
	coder: cid.Base64URL,
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

class Chash {
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
				return this.fromParts(DataURL, encode_mime_data(hint, utils.toBytes(x)));
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
		cid.uvarint.write(len, codec);
		let v = new Uint8Array(len.length + data.length);
		v.set(len);
		v.set(data, len.length);
		return new this(v);
	}
	static fromOnion(hash) {
		// https://github.com/torproject/torspec/blob/main/rend-spec-v3.txt
		let data = cid.Base32.decode(hash); // must decode, throws
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
			[codec, pos] = cid.uvarint.read(bytes);
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
		return this.fromParts(GenericURL, utils.utf8ToBytes(url));
	}
	constructor(bytes) {
		this.bytes = bytes;
	}
	get codec() {
		return cid.uvarint.read(this.bytes)[0];
	}
	get spec() { 
		return CODEC_MAP.get(this.codec);
	}
	get data() {
		return this._data.slice();
	}
	get _data() {
		let v = this.bytes;
		return v.subarray(cid.uvarint.read(v)[1]);
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
		if (value instanceof this) {
			return new this(value.bytes.slice()); // copy
		}
		try {
			let temp = try_coerce_bytes(value);
			if (temp instanceof Uint8Array) {
				return new this(temp);
			} else if (typeof value === 'object') {
				return this.fromXY(value.x, value.y);
			} 
			throw new Error('unknown format');
		} catch (err) {
			throw error_with('invalid pubkey', {value}, err);
		}
	}
	constructor(v) {
		if (v) {
			if (v instanceof Uint8Array && v.length == 64) {
				this.bytes = v; // this is unsafe constructor
			} else {
				throw error_with('expected 64 bytes', {bytes: v});
			}
		} else {
			this.bytes = new Uint8Array(64);
		}
	}
	get isNull() { return this.bytes.every(x => x == 0); }
	set x(x) { this.bytes.set(bytes32_from(x)); }
	set y(x) { this.bytes.set(bytes32_from(x), 32); }
	get x() { return this.bytes.slice(0, 32); }
	get y() { return this.bytes.slice(32); }
	get address() { 
		return ETH.format(sha3.keccak_256(this.bytes).subarray(-20)); // should this be Address()? 
	}
	toObject() {
		let {x, y, address} = this;
		return {x, y, address};
	}
	toPhex() {
		return phex_from_bytes(this.bytes);
	}
	toJSON() {
		let v = this.bytes;
		return {
			x: short_phex(v.subarray(0, 32)), // this needed?
			y: short_phex(v.subarray(32))
		};
	}
}

function short_phex(v) {
	return utils.bytesToHex(v).replace(/^0+(?!$)/, '0x');
}

const SEL_TEXT   = 0x59d1d43c; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=text%28bytes32%2Cstring%29&escape=1&encoding=utf8
const SEL_ADDR   = 0xf1cb7e06; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=addr%28bytes32%2Cuint256%29&escape=1&encoding=utf8
const SEL_CHASH  = 0xbc1c58d1; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=contenthash%28bytes32%29&escape=1&encoding=utf8
const SEL_PUBKEY = 0xc8690233; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=pubkey%28bytes32%29&escape=1&encoding=utf8
const SEL_NAME   = 0x691f3431; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=name%28bytes32%29&escape=1&encoding=utf8
const SEL_ADDR0  = 0x3b3b57de; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=addr%28bytes32%29&escape=1&encoding=utf8

//const SEL_RESOLVE  = 0x9061b923; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=resolve%28bytes%2Cbytes%29&escape=1&encoding=utf8
//const SEL_MULTICALL = 0xac9650d8; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=multicall%28bytes%5B%5D%29&escape=1&encoding=utf8

const PREFIX_COIN = '$';
const PREFIX_MAGIC = '#';
const PREFIX_CHASH  = PREFIX_MAGIC + 'chash';
const PREFIX_PUBKEY = PREFIX_MAGIC + 'pubkey';
const PREFIX_NAME   = PREFIX_MAGIC + 'name';

// TODO: add missing profiles, like ABI()

function try_coerce_bytes_nonempty(x) {
	let v = try_coerce_bytes(x);
	if (x && (x === v || v.length)) return v;
}

class Record {
	static isSpecialKey(s) {
		return s?.startsWith(PREFIX_COIN) || s?.startsWith(PREFIX_MAGIC);
	}
	static from(xs, silent) {
		let r = new this();
		r.import(xs, silent);
		return r;
	}
	constructor() {
		this._texts  = new Map();
		this._addrs  = new Map();
		this._chash  = undefined;
		this._pubkey = undefined;
		this._name   = undefined;
	}
	get size() {
		return this._texts.size + this._addrs.size + (this._chash?1:0) + (this._pubkey?1:0) + (this._name?1:0);
	}
	import(xs, silent) {
		if (xs instanceof Record) { // copy
			for (let [k, x] of xs._texts) this.set(k, x);
			for (let [k, x] of xs._addrs) this.set(k, x.slice());
			if (xs._chash)  this._chash  = xs._chash.slice();
			if (xs._pubkey) this._pubkey = xs._pubkey.slice();
			if (xs._name)   this._name   = xs._name;
		} else if (Array.isArray(xs)) { 
			for (let [k, x] of xs) this.set(k, x, silent);
		} else {
			for (let [k, x] of Object.entries(xs)) this.set(k, x, silent);
		}
	}
	getChash() { 
		let v = this._chash;
		return v ? new Chash(v) : undefined;
	}
	setChash(x, hint) {
		let v = try_coerce_bytes_nonempty(x);
		this._chash = v ? Chash.from(v, hint).bytes : undefined;
	}
	getPubkey() { 
		let v = this._pubkey; 
		return v ? new Pubkey(v) : undefined;
	}
	setPubkey(x) {
		let v = try_coerce_bytes_nonempty(x);
		this._pubkey =  v ? Pubkey.from(v).bytes : undefined;
	}
	setName(x) {
		if (x && !is_string(x)) {
			throw error_with('expected string', {name: x})
		}
		this._name = x || undefined;
	}
	getTexts() {
		return [...this._texts];
	}
	setText(key, value) {
		if (!is_string(key) || (value && !is_string(value))) {
			throw error_with('expected strings', {key, value})
		} 
		if (value) {
			this._texts.set(key, value);
		} else {
			this._texts.delete(key);
		}
	}
	getAddresses() {
		return Array.from(this._addrs, ([k, x]) => new Address(Coin.fromType(k), x));
	}
	getAddress(x) { 
		let coin = Coin.from(x);
		let v = this._addrs.get(coin.type);
		return v ? new Address(coin, v) : undefined;
	}
	setAddress(x, y) {
		if (x instanceof Address) {
			this._addrs.set(x.coin.type, x.bytes.slice());
		} else {
			let coin = Coin.from(x);
			let v = try_coerce_bytes_nonempty(y);
			if (v) {
				this._addrs.set(coin.type, Address.from(coin, v).bytes);
			} else {
				this._addrs.delete(coin.type);
			}
		}
	}
	set(key, value, silent) {
		try {
			if (is_string(key)) {
				if (key.startsWith(PREFIX_COIN)) {
					return this.setAddress(key.slice(PREFIX_COIN.length), value);
				} else if (key.startsWith(PREFIX_MAGIC)) {
					switch (key) {
						case PREFIX_CHASH:  return this.setChash(value);
						case PREFIX_PUBKEY: return this.setPubkey(value);
						case PREFIX_NAME:   return this.setName(value);
						default:            return this.setChash(value, key.slice(PREFIX_MAGIC.length));
					}
				} else {
					return this.setText(key, value);
				}
			} else { //if (key instanceof Coin || is_number(key) || is_bigint(key)) {
				return this.setAddress(key, value);
			}
			//throw new Error('unknown key');
		} catch (err) {
			if (!silent) throw error_with(`set "${key}": ${err.message}`, {key, value}, err);
		}
	}
	_entries(fn) {
		let m = [...this._texts].map(([k, x]) => [k, fn(x), SEL_TEXT]);
		for (let a of this.getAddresses()) {
			m.push([PREFIX_COIN + a.coin.name, fn(a), SEL_ADDR]);
		}
		let chash = this.getChash();
		if (chash) {
			m.push([PREFIX_CHASH, fn(chash), SEL_CHASH]);
		}
		let pubkey = this.getPubkey();
		if (pubkey) {
			m.push([PREFIX_PUBKEY, fn(pubkey), SEL_PUBKEY]);
		}
		let {_name} = this;
		if (_name) {
			m.push([PREFIX_NAME, fn(_name), SEL_NAME]);
		}
		return m;
	}
	[Symbol.iterator]() {
		return this._entries(x => x)[Symbol.iterator]();
	}
	toEntries(hr) {
		let m = [...this._texts];
		for (let [k, x] of this._addrs) {
			let coin = Coin.fromType(k);
			m.push([PREFIX_COIN + coin.name, coin.format(x)]);
		}
		let chash = this.getChash();
		if (chash) {
			if (hr) {
				let [short, value] = chash.toEntry();
				m.push([short ? PREFIX_MAGIC + short : PREFIX_CHASH, value]);
			} else {
				m.push([PREFIX_CHASH, chash.toPhex()]);
			}
		}
		let pubkey = this.getPubkey();
		if (pubkey) {
			m.push([PREFIX_PUBKEY, hr ? pubkey.toJSON() : pubkey.toPhex()]);
		}
		let {_name} = this;
		if (_name) {
			m.push([PREFIX_NAME, _name]);
		}
		return m;
	}
	toObject() {
		return Object.fromEntries(this._entries(x => is_string(x) ? x : x.toObject())); // TODO can i use valueOf() ?
	}
	toJSON(hr) {
		return Object.fromEntries(this.toEntries(hr));
	}
	parseCalls(calls, answers) {
		if (calls.length != answers.length) {
			throw error_with('call/answer mismatch', {calls: calls.length, answers: answers.size})
		}
		calls.forEach((call, i) => {
			try {
				this.parseCall(call, answers[i]);
			} catch (err) {
			}
		});
	}
	parseCall(call, answer) {
		try {
			call = bytes_from(call, false);
			answer = bytes_from(answer, false);
			if (!answer.length) {
				throw new Error('no answer');
			} else if (!((answer.length - 4) & 31)) {
				throw new Error('revert');
			} else if (answer.length & 31) {
				throw new Error('odd answer');
			}
			let dv = utils.createView(call);
			switch (dv.getUint32(0)) {
				case SEL_TEXT: {
					let key = utf8_from_bytes(read_memory(call.subarray(4), 32));
					let value = utf8_from_bytes(read_memory(answer, 0));
					return this.setText(key, value);
				}
				case SEL_ADDR: {
					let v = read_memory(answer, 0);
					return this.setAddress(bigint_at(call, 36), v.length && v);
				}
				case SEL_CHASH: {
					let v = read_memory(answer, 0);
					return this.setChash(v.length && v);
				}
				case SEL_NAME:   return this.setName(utf8_from_bytes(read_memory(answer, 0)));
				case SEL_PUBKEY: return this.setPubkey(answer.some(x => x) && answer);
				case SEL_ADDR0: {
					if (answer.length != 32) throw new Error('expected 32 bytes');
					let v = answer.subarray(-20);
					return this.setAddress(60, v.some(x => x) && v);
				}
				default: throw new Error('unknown sighash');
			}
		} catch (err) {
			throw error_with('parse error', {call, answer}, err);
		}
	}
	// ezccip interface
	text(key)     { return this._texts.get(key); }
	addr(type)    { return this._addrs.get(Coin.type(type)); }
	contenthash() { return this._chash; }
	pubkey()      { return this._pubkey; }
	name()        { return this._name; }
}
for (let x of [PREFIX_CHASH, PREFIX_PUBKEY, PREFIX_NAME]) {
	Object.defineProperty(Record, x.slice(PREFIX_MAGIC.length).toUpperCase(), {value: x});
}

class Profile {	
	static ENS() {
		// ens standard profile
		// https://github.com/ensdomains/ens-app-v3/blob/main/src/constants/textRecords.ts
		// https://github.com/ensdomains/ens-app-v3/blob/main/src/constants/supportedAddresses.ts
		let p = new Profile();
		p.setText([
			'name',
			'email',
			'url',
			'avatar',
			'location',
			'description',
			'notice',
			'keywords',
			'com.discord',
			'com.github',
			'com.reddit',
			'com.twitter',
			'org.telegram',
		]);
		p.setCoin(['eth', 'btc', 'bnb', 'doge', 'ltc', 'dot', 'sol']);
		p.chash = true;
		p.pubkey = true;
		return p;
	}
	static from(x) {
		let p = new this();
		p.import(x);
		return p;
	}
	constructor() {
		this.clear();
	}
	clear() {
		this.texts = new Set();
		this.coins = new Set();
		this.chash = false;
		this.pubkey = false;
		this.name = false;
		this.addr0 = false;
	}
	get size() {
		return this.texts.size + this.coins.size + this.chash + this.pubkey + this.name + this.addr0;
	}
	import(x) {
		if (x instanceof Record) {
			for (let k of x._texts.keys()) this.texts.add(k);
			for (let k of x._addrs.keys()) this.coins.add(k);
			if (x._chash)  this.chash = true;
			if (x._pubkey) this.pubkey = true;
			if (x._name)   this.name = true;
		} else if (x instanceof Profile) {
			for (let k of x.texts) this.texts.add(k);
			for (let k of x.coins) this.coins.add(k);
			this.chash  = x.chash;
			this.pubkey = x.pubkey;
			this.name   = x.name;
			this.addr0  = x.addr0;
		} else if (x && typeof x === 'object') {
			// https://github.com/ensdomains/ensjs-v3/blob/7e01ad8579c08b453fc64b1972b764b6d884b774/packages/ensjs/src/functions/public/getRecords.ts#L33
			if (Array.isArray(x.texts)) this.setText(x.texts);
			if (Array.isArray(x.coins)) this.setCoin(x.coins);
			this.chash = !!x.contentHash;
			//this.abi = !!x.abi;
		} else {
			throw error_with('unknown profile format', {profile: x});
		}
	}
	setProp(x, on = true) {
		if (Array.isArray(x)) {
			for (let y of x) this.setProp(y, on);
		} else {
			switch (x) {
				case PREFIX_CHASH:  this.chash  = on; break;
				case PREFIX_PUBKEY: this.pubkey = on; break;
				case PREFIX_NAME:   this.name   = on; break;
				default: throw error_with('unknown prop', {prop: x});
			}
		}
	}
	setText(x, on = true) {
		if (Array.isArray(x)) {
			for (let y of x) this.setText(y, on);
		} else if (on) {
			this.texts.add(x);
		} else {
			this.texts.delete(x);
		}
	}
	setCoin(x, on = true) {
		if (Array.isArray(x)) {
			for (let y of x) this.setCoin(y, on);
		} else {
			let {type} = Coin.from(x);
			if (on) {
				this.coins.add(type);
			} else {
				this.coins.delete(type);
			}
		}
	}
	makeCallsForName(name) {
		return this.makeCalls(namehash(name));
	}
	makeCalls(node = 0) {
		node = bytes32_from(node);
		let calls = [];
		for (let x of this.texts) {
			calls.push(make_call_with_bytes(SEL_TEXT, node, utils.utf8ToBytes(x)));
		}
		for (let x of this.coins) {
			calls.push(make_call_with_uint(SEL_ADDR, node, x));
		}
		if (this.chash)  calls.push(make_call(SEL_CHASH, node));
		if (this.pubkey) calls.push(make_call(SEL_PUBKEY, node));
		if (this.name)   calls.push(make_call(SEL_NAME, node));
		if (this.addr0)  calls.push(make_call(SEL_ADDR0, node));
		return calls;
	}
	/*
	makeCallForName(name, outer) {
		let calls = this.makeCallsForName(name);
		if (calls.length === 1) {
			return encode(SEL_RESOLVE, [{type: 'bytes', value: }])
		} else if (outer) {

		} else {

		}
	}
	*/
}

function make_call(selector, node) {
	let v = new Uint8Array(36);
	let dv = new DataView(v.buffer);
	dv.setUint32(0, selector);
	v.set(node, 4);
	return v;
}
function make_call_with_bytes(selector, node, data) {
	let v = new Uint8Array(100 + (Math.ceil(data.length / 32) << 5));
	let dv = new DataView(v.buffer);
	dv.setUint32(0, selector);
	v.set(node, 4);
	v[67] = 64;
	dv.setUint32(96, data.length);
	v.set(data, 100);
	return v;
}
function make_call_with_uint(selector, node, arg) {
	let v = new Uint8Array(68);
	let dv = new DataView(v.buffer);
	dv.setUint32(0, selector);
	v.set(node, 4);
	v.set(bytes32_from(arg), 36);
	return v;
}

function safe_uint(i) {
	if (i > Number.MAX_SAFE_INTEGER) throw error_with('overflow', {i});
	return Number(i);
}

function read_memory(v, pos) {
	pos = safe_uint(bigint_at(v, pos));
	let len = safe_uint(bigint_at(v, pos)); pos += 32;
	return v.subarray(pos, pos + len);
}

const LABEL_SELF = '.';

class Node extends Map {
	static create(name) {
		return this.root().create(name);
	}
	static root(tag) {
		return new this(`[${tag || 'root'}]`);
	}
	constructor(label, parent) {
		super();
		this.label = label;
		this.parent = parent || undefined;
		this.record = null;
	}
	get labelhash() {
		// note: root labelhash is undefined
		return this.parent ? sha3.keccak_256(this.label) : new Uint8Array(32);
	}
	get namehash() {
		return namehash(this.path().map(x => x.label));
	}
	get dns() {
		return dns_encoded(this.path().map(x => x.label));
	}
	get prettyName() {
		return ensNormalize.ens_beautify(this.name);
	}
	get name() {
		return this.path().map(x => x.label).join('.');
	}
	get depth() {
		let n = 0;
		for (let x = this; x.parent; x = x.parent) ++n;
		return n;
	}
	get nodeCount() {
		let n = 0;
		this.scan(() => ++n);
		return n;
	}
	get root() {
		let x = this;
		while (x.parent) x = x.parent;
		return x;
	}
	path(inc_root) {
		// raffy.eth => [raffy.eth, eth, <root>?]
		let v = [];
		for (let x = this; inc_root ? x : x.parent; x = x.parent) v.push(x);
		return v;
	}
	// get node "a" from "a.b.c" or null
	// find("") is identity
	find(name) {
		return namesplit(name).reduceRight((x, s) => x?.get(s), this);
	}
	// ensures the nodes for "a.b.c" exist and returns "a"
	create(name) {
		return namesplit(name).reduceRight((x, s) => x.child(s), this);
	}
	// gets or creates a subnode of this node
	child(label) {
		if (!label) throw new Error('empty label');
		label = ensNormalize.ens_normalize(label);
		if (label.includes('.')) throw error_with('expected single label', {label});
		let node = this.get(label);
		if (!node) {
			node = new Node(label, this);
			this.set(label, node);
		}
		return node;
	}
	import(obj) {
		// TODO should this support arrays?
		try {
			if (typeof obj !== 'object' || Array.isArray(obj)) throw new Error('expected object');
			let rest = [];
			for (let [k, v] of Object.entries(obj)) {
				if (k === LABEL_SELF) {
					this.record = Record.from(v);
				} else if (!Record.isSpecialKey(k) && v?.constructor === Object) {
					let ks = k.trim();
					if (!ks) throw new Error('expected label');
					for (let k of ks.split(/\s+/)) {
						this.create(k).import(v);
					}
				} else {
					rest.push([k, v]);
				}
			}
			if (rest.length) {
				if (!this.record) this.record = new Record();
				this.record.import(rest);
			}
		} catch (err) {
			throw error_with(`import "${this.name}": ${err.message}`, {json: obj}, err);
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
	scan(fn, level = 0) {
		fn(this, level++);
		for (let x of this.values()) {
			x.scan(fn, level);
		}
	}
	collect(fn) {
		let v = [];
		this.scan((x, n) => {
			let res = fn(x, n);
			if (res != null) v.push(res); // allow "" and false
		});
		return v;
	}
	flat() {
		return this.collect(x => x);
	}
	print() {
		this.scan((x, n) => {
			let line = '  '.repeat(n) + x.label;
			if (x.record) line += '*'; // label* => this node has a record
			if (x.size) line += ` (${x.size})`; // (#) => this node has subdomains
			console.log(line);
		});
	}
}

exports.Address = Address;
exports.Arweave = Arweave;
exports.Chash = Chash;
exports.Coin = Coin;
exports.DataURL = DataURL;
exports.ETH = ETH;
exports.GenericURL = GenericURL;
exports.IPFS = IPFS;
exports.IPNS = IPNS;
exports.Node = Node;
exports.Onion = Onion;
exports.Profile = Profile;
exports.Pubkey = Pubkey;
exports.Record = Record;
exports.SPECS = SPECS;
exports.Swarm = Swarm;
exports.UnknownCoin = UnknownCoin;
exports.UnnamedCoin = UnnamedCoin;
exports.UnnamedEVMCoin = UnnamedEVMCoin;
exports.array_equals = array_equals;
exports.bigint_at = bigint_at;
exports.bytes32_from = bytes32_from;
exports.bytes_from = bytes_from;
exports.dns_encoded = dns_encoded;
exports.error_with = error_with;
exports.is_bigint = is_bigint;
exports.is_number = is_number;
exports.is_samecase_phex = is_samecase_phex;
exports.is_string = is_string;
exports.namehash = namehash;
exports.namesplit = namesplit;
exports.phex_from_bytes = phex_from_bytes;
exports.try_coerce_bytes = try_coerce_bytes;
exports.utf8_from_bytes = utf8_from_bytes;
