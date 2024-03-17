import {Coin} from './Coin.js';
import {Address} from './Address.js';
import {Chash} from './Chash.js';
import {Pubkey} from './Pubkey.js';
import {error_with, is_string, is_bigint, bytes32_from, utf8_from_bytes, bigUintAt, bytes_from} from './utils.js';
import {keccak_256} from '@noble/hashes/sha3';
import {createView, utf8ToBytes} from '@noble/hashes/utils';

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

export class Record {
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
			let dv = createView(call);
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

export class Profile {	
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
		return this.makeCalls(keccak_256(name));
	}
	makeCalls(node = 0) {
		node = bytes32_from(node);
		let calls = [];
		for (let x of this.texts) {
			calls.push(make_call_with_bytes(TEXT, node, utf8ToBytes(x)));
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