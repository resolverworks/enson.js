'use strict';

var addressEncoder = require('@ensdomains/address-encoder');
var utils = require('@noble/hashes/utils');
var cid = require('@adraffy/cid');
var sha3 = require('@noble/hashes/sha3');
var coins = require('@ensdomains/address-encoder/coins');

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
	return is_string(s) && /^0x([0-9A-F]+|[0-9a-f]+)/i.test(s);
}

function bytes_from(x, copy = true) {
	if (x instanceof Uint8Array) {
		return copy ? x.slice() : x;
	}
	let v = try_coerce_bytes(x);
	if (v !== x) return v;
	throw error_with('expected bytes-like', {value: x});
}

// always !== if successful
function try_coerce_bytes(x) {
	if (x instanceof Uint8Array) {
		return x.slice();
	} else if (is_samecase_phex(x)) {
		return utils.hexToBytes(x.slice(2));
	} else if (Array.isArray(x)) {
		return Uint8Array.from(x);
	} else {
		return x;
	} 
}

function utf8_from_bytes(v) {
	return new TextDecoder().decode(v);
}

function bytes32_from(x) {
	if (x instanceof Uint8Array) {
		if (x.length !== 32) throw error_with('expected 32-bytes', {value: x});
		return x.slice();
	}
	return utils.hexToBytes(BigInt(x).toString(16).padStart(64, '0').slice(-64));
}

function bigUintAt(v, i) {
	return BigInt(utils.bytesToHex(v.subarray(i, i + 32)));
}

function array_equals(a, b) {
	if (a === b) return true;
	let n = a.length;
	let c = b.length === n;
	for (let i = 0; !c && i < n; i++) c = a[i] === b[i];
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

// TODO: should this be BigInt?
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
					Object.defineProperties(coin, {
						name: {value: names[0], enumerable: true},
						title: {value: names[1], enumerable: true},
						parse: {value: decode},
						format: {value: encode},
					});
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
			type = addressEncoder.coinNameToTypeMap[name];
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
		let {type} = this;
		if (type === TYPE_ETH) {
			return 1;
		} else if (type & MSB) {
			return Number(type & (MSB-1n));
		}
	}
	toObject() {
		let {type, name, title, chain} = this;
		return {type, name, title, chain};
	}
}

class UnnamedCoin extends Coin {
	get isUnnamed() { return true; }
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
	parse(s)    { throw error_with('unknown parser', {coin: this, value: s}); }
	format(v)   { return `[0x${utils.bytesToHex(v)}]`; }
	toObject() {
		let {type, title} = this;
		return {type, title};
	}
}

const ETH = Coin.fromType(TYPE_ETH);

class Address {
 	static from(coin, value) {
		if (value === undefined) { // eth shorthand
			value = coin;
			coin = ETH;
		} else {
			coin = Coin.from(coin);
		}
		let v = try_coerce_bytes(value);
		if (v !== value) {
			coin.format(v); // validate
			return new this(coin, v);
		} else if (is_string(value)) {
			return new this(coin, coin.parse(value));
		}
		throw new error_with('unknown address format', {coin, value});
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
		return '0x' + utils.bytesToHex(this.bytes);
	}
	toString() {
		return this.value;
	}
	toJSON() {
		return this.value;
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
		v.set(toBytes(ONION_SUFFIX + ' checksum'));
		v.set(pubkey, 15);
		v.set(47, version);
		let bytes = new Uint8Array(35);
		bytes.set(pubkey);
		bytes.set(32, sha3.keccak_256(v).subarray(0, 2));
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
	parseHash(s) { return cid.CID.from(s).bytes; }
	toHash(v)    { return cid.CID.from(v).toString(); }
	toObject(v)  { return cid.CID.from(v); }
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

const SPECS = Object.freeze([
	IPFS,
	IPNS,
	Swarm,
	Arweave,
	Onion_Legacy,
	Onion,
	DataURL,
	GenericURL
]);
const CODEC_MAP = new Map(SPECS.map(x => [x.codec, x]));
const SCHEME_MAP = new Map(SPECS.filter(x => x.scheme).map(x => [x.scheme, x]));

class Chash {
	static from(x, hint) {
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
			if (!array_equals(data, expect)) throw error_with('invalid checksum', {hash, data, expect});
			return this.fromParts(spec, data);
		}
		throw error_with('invalid hash', {hash, data});
	}
	static fromBytes(x) {
		let bytes = bytes_from(x, false);
		let [codec, pos] = cid.uvarint.read(bytes);
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
		return this.spec.toObject(this._data); 
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
		return '0x' + utils.bytesToHex(this.bytes); 
	}
	toJSON() { 
		return this.toURL(); 
	}
}

// simple parsing since URL varies between browsers
function split_url(url) {
	let pos = url.indexOf(SCHEME_SEPARATOR);
	if (!pos) throw error_with('expected scheme separator', {url});
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
			} else if (is_samecase_phex(value)) {
				return new this(utils.hexToBytes(value.slice(2)));
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
				this.bytes = v.slice();
			} else {
				throw error_with('expected 64 bytes', {bytes: v});
			}
		} else {
			this.bytes = new Uint8Array(64);
		}
	}
	get empty() { return this.bytes.every(x => x == 0); }
	set x(x) { this.bytes.set(bytes32_from(x), 0); }
	set y(x) { this.bytes.set(bytes32_from(x), 32); }
	get x() { return this.bytes.slice(0, 32); }
	get y() { return this.bytes.slice(32); }
	get address() { return coins.eth.encode(sha3.keccak_256(this.bytes).subarray(-20)); }
	toObject() {
		let {x, y, address} = this;
		return {x, y, address};
	}
	toJSON() {
		return {
			x: drop_zeros(utils.bytesToHex(this.x)),
			y: drop_zeros(utils.bytesToHex(this.y))
		};
	}
}

function drop_zeros(s) {
	return s.replace(/^0*/, '0x');
}

const TEXT    = 0x59d1d43c; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=text%28bytes32%2Cstring%29&escape=1&encoding=utf8
const ADDR    = 0xf1cb7e06; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=addr%28bytes32%2Cuint256%29&escape=1&encoding=utf8
const CHASH   = 0xbc1c58d1; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=contenthash%28bytes32%29&escape=1&encoding=utf8
const PUBKEY  = 0xc8690233; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=pubkey%28bytes32%29&escape=1&encoding=utf8
const NAME    = 0x691f3431; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=name%28bytes32%29&escape=1&encoding=utf8
const ADDR0   = 0x3b3b57de; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=addr%28bytes32%29&escape=1&encoding=utf8

const PREFIX_COIN = '$';
const PREFIX_MAGIC = '#';

const SYM_CHASH  = Symbol('#chash');
const SYM_PUBKEY = Symbol('#pubkey');
const SYM_NAME   = Symbol('#name');

class Record {
	static get CHASH() { return SYM_CHASH; }
	static get PUBKEY() { return SYM_PUBKEY; }
	static get NAME() { return SYM_NAME; }
	static from(json) {
		let r = new this();
		for (let [k, v] of Object.entries(json)) {
			r.put(k, v);
		}
		return r;
	}
	constructor() {
		this.map = new Map();
	}
	get size() {
		return this.map.size;
	}
	[Symbol.iterator]() {
		return this.mapEntries(x => x);
	}
	*mapEntries(fn) {
		for (let [k, x] of this.map) {
			if (is_string(k)) {
				yield [k, fn(x)];
			} else if (is_bigint(k)) {
				yield [PREFIX_COIN + x.coin.name, fn(x)];
			} else if (typeof k === 'symbol') {
				yield [k.description, fn(x)];
			}
		}
	}
	getChash() { return this.map.get(SYM_CHASH); }
	setChash(x) {
		if (x) {
			this.map.set(SYM_CHASH, x instanceof Chash ? x : Chash.from(x));
		} else {
			this.map.delete(SYM_CHASH);
		}
	}
	getPubkey() { return this.map.get(SYM_PUBKEY); }
	setPubkey(x) {
		if (x) {
			this.map.set(SYM_PUBKEY, x instanceof Pubkey ? x : Pubkey.from(x));
		 } else {
			this.map.delete(SYM_PUBKEY);
		 }
	}
	setName(x) {
		if (x && !is_string(x)) {
			throw error_with('unknown name', {name: x})
		} else if (x) {
			this.map.set(SYM_NAME, x);
		} else {
			this.map.delete(SYM_NAME);
		}
	}
	setText(key, value) {
		if (!is_string(key) || (value && !is_string(value))) {
			throw error_with('expected key', {key, value})
		} else if (value) {
			this.map.set(key, value);
		} else {
			this.map.delete(key);
		}
	}
	getAddress(x) { return this.map.get(Coin.from(x).type); }
	setAddress(x, y) {
		if (x instanceof Address) {
			this.map.set(x.coin.type, x);
		} else if (y) {
			let a = Address.from(x, y);
			this.map.set(a.coin.type, a);
		} else {
			this.map.delete(Coin.from(x).type);
		}
	}
	put(key, value) {
		try {
			let k = key;
			if (typeof k === 'symbol') {
				k = k.description;
			} else if (!is_string(k)) {
				throw new Error('expected key');
			}
			if (k.startsWith(PREFIX_COIN)) {
				this.setAddress(k.slice(PREFIX_COIN.length), value);
			} else if (k === SYM_PUBKEY.description) {
				this.setPubkey(value);
			} else if (k === SYM_NAME.description) {
				this.setName(value);
			} else if (k.startsWith(PREFIX_MAGIC)) {
				this.setChash(value && Chash.from(value, k.slice(PREFIX_MAGIC.length)));
			} else {
				this.setText(k, value);
			}
		} catch (err) {
			throw error_with(`put "${key}": ${err.message}`, {key, value}, err);
		}
	}
	toObject() {
		return Object.fromEntries(this.mapEntries(x => is_string(x) ? x : x.toObject()));
	}
	toJSON() {
		return Object.fromEntries(this.mapEntries(x => is_string(x) ? x : x.toJSON()));		
	}
	parseCalls(calls, answers) {
		if (calls.size != answers.length) {
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
				case CHASH: {
					this.chash = read_memory(answer, 0);
					break;
				}
				case PUBKEY: {
					this.pubkey = Pubkey.from(answer);
					break;
				}
				case ADDR0: {
					let v = read_memory(answer, 0);
					if (v.length != 32) throw new Error('expected 32 bytes');
					this.map.setAddress(60, v.some(x => x) ? v.subarray(-20) : null);
					break;
				}
				case NAME: {
					this.map.setName(utf8_from_bytes(read_memory(answer, 0)));
					break;
				}
				case ADDR: {
					this.map.setAddress(bigUintAt(call, 36), read_memory(answer, 0));
					break;
				}
				case TEXT: {
					this.map.setText(utf8_from_bytes(read_memory(call, 36)), utf8_from_bytes(read_memory(answer, 0)));
					break;
				}
				default: throw new Error('unknown sighash');
			}
		} catch (err) {
			throw error_with('parse error', {call, answer}, err);
		}
	}
	// ezccip interface
	text(key)     { return this.map.get(key); }
	addr(type)    { return this.map.get(type instanceof Coin ? type.type : BigInt(type))?.bytes; }
	contenthash() { return this.map.get(SYM_CHASH)?.bytes; }
	pubkey()      { return this.map.get(SYM_PUBKEY)?.bytes; }
	name()        { return this.map.get(SYM_NAME); }
}

class Profile {	
	static from(x) {
		if (x instanceof Record) {
			let p = new this();
			p.copyRecord(x);
			return p;
		}
		// TODO json?
		throw error_with('unknown profile', {profile: x});
	}
	constructor() {
		this.clear();
	}
	clear() {
		this.texts = new Set();
		this.addrs = new Set();
		this.chash = false;
		this.pubkey = false;
		this.name = false;
		this.addr0 = false;
	}
	get size() {
		return this.texts.size + this.addrs.size + this.chash + this.pubkey + this.addr0 + this.name;
	}
	copyRecord(r) {
		for (let k of r.map.keys()) {
			if (is_string(k)) {
				this.texts.add(k);
			} else if (is_bigint(k)) {
				this.addrs.add(k);
			} else if (typeof k === 'symbol') {
				this.setProp(k);
			}
		}
	}
	setProp(x, on = true) {
		if (Array.isArray(x)) {
			for (let y of x) this.setProp(y, on);
		} else {
			switch (x) {
				case SYM_CHASH:  this.chash  = on; break;
				case SYM_PUBKEY: this.pubkey = on; break;
				case SYM_NAME:   this.name   = on; break;
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
				this.addrs.add(type);
			} else {
				this.addrs.delete(type);
			}
		}
	}
	makeCallsForName(name) {
		return this.makeCalls(sha3.keccak_256(name));
	}
	makeCalls(node = 0) {
		node = bytes32_from(node);
		let calls = [];
		for (let x of this.texts) {
			calls.push(make_call_with_bytes(TEXT, node, utils.utf8ToBytes(x)));
		}
		for (let x of this.addrs) {
			calls.push(make_call_with_uint(ADDR, node, x));
		}
		if (this.chash)  calls.push(make_call(CHASH, node));
		if (this.pubkey) calls.push(make_call(PUBKEY, node));
		if (this.name)   calls.push(make_call(NAME, node));
		if (this.addr0)  calls.push(make_call(ADDR0, node));
		return calls;
	}
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
	pos = safe_uint(bigUintAt(v, pos));
	let len = safe_uint(bigUintAt(v, pos)); pos += 32;
	return v.subarray(pos, pos + len);
}

const LABEL_SELF = '.';

function split(s) {
	return s ? s.split('.') : [];
}

class Node extends Map {
	static root(name) {
		return new this(`[${name || 'root'}]`);
	}
	constructor(label, parent) {
		super();
		this.label = label;
		this.parent = parent || undefined;
		this.record = null;
	}
	get name() {
		if (!this.parent) return '';
		let v = [];
		for (let x = this; x.parent; x = x.parent) v.push(x.label);
		return v.join('.');
	}
	get depth() {
		let n = 0;
		for (let x = this; x.parent; x = x.parent) ++n;
		return n;
	}
	get nodes() {
		let n = 0;
		this.scan(() => ++n);
		return n;
	}
	// get node "a" from "a.b.c" or null
	// find("") is identity
	find(name) {
		return split(name).reduceRight((x, s) => x?.get(s), this);
	}
	// ensures the nodes for "a.b.c" exist and returns "a"
	create(name) {
		return split(name).reduceRight((x, s) => x.child(s), this);
	}
	// gets or creates a subnode of this node
	child(label) {
		let node = this.get(label);
		if (!node) {
			if (!label) throw new Error('empty label');
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
					if (ks === LABEL_SELF) continue; // skip record type
					ks = ks.trim();
					if (!ks) throw new Error('expected label');
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
