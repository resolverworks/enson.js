import {Coin} from './Coin.js';
import {Address} from './Address.js';
import {Chash} from './Chash.js';
import {Pubkey} from './Pubkey.js';
import {error_with, is_string, bytes32_from, utf8_from_bytes, bigint_at, bytes_from, namehash, try_coerce_bytes} from './utils.js';
import {createView, utf8ToBytes} from '@noble/hashes/utils';

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

export class Record {
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
			let dv = createView(call);
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

export class Profile {	
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
			calls.push(make_call_with_bytes(SEL_TEXT, node, utf8ToBytes(x)));
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
