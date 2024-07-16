import {Coin} from './Coin.js';
import {Address} from './Address.js';
import {Chash} from './Chash.js';
import {Pubkey} from './Pubkey.js';
import {
	error_with, is_string, bytes32_from, utf8_from_bytes, bigint_at, 
	bytes_from, namehash, try_coerce_bytes, abi_encode, 
	array_equals, phex_from_bytes
} from './utils.js';
import {createView} from '@noble/hashes/utils';

const SEL_TEXT   = 0x59d1d43c; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=text%28bytes32%2Cstring%29&escape=1&encoding=utf8
const SEL_ADDR   = 0xf1cb7e06; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=addr%28bytes32%2Cuint256%29&escape=1&encoding=utf8
const SEL_CHASH  = 0xbc1c58d1; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=contenthash%28bytes32%29&escape=1&encoding=utf8
const SEL_PUBKEY = 0xc8690233; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=pubkey%28bytes32%29&escape=1&encoding=utf8
const SEL_NAME   = 0x691f3431; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=name%28bytes32%29&escape=1&encoding=utf8
const SEL_ADDR0  = 0x3b3b57de; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=addr%28bytes32%29&escape=1&encoding=utf8

const SEL_SET_TEXT   = 0x10f13a8c; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=setText%28bytes32%2Cstring%2Cstring%29&escape=1&encoding=utf8
const SEL_SET_ADDR   = 0x8b95dd71; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=setAddr%28bytes32%2Cuint256%2Cbytes%29&escape=1&encoding=utf8
const SEL_SET_CHASH  = 0x304e6ade; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=setContenthash%28bytes32%2Cbytes%29&escape=1&encoding=utf8
const SEL_SET_PUBKEY = 0x29cd62ea; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=setPubkey%28bytes32%2Cbytes32%2Cbytes32%29&escape=1&encoding=utf8
const SEL_SET_ADDR0  = 0xd5fa2b00; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=setAddr%28bytes32%2Caddress%29&escape=1&encoding=utf8
const SEL_SET_NAME   = 0x77372213; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=setName%28bytes32%2Cstring%29&escape=1&encoding=utf8

//const SEL_RESOLVE  = 0x9061b923; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=resolve%28bytes%2Cbytes%29&escape=1&encoding=utf8
//const SEL_MULTICALL = 0xac9650d8; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=multicall%28bytes%5B%5D%29&escape=1&encoding=utf8

const PREFIX_COIN   = '$';
const PREFIX_MAGIC  = '#';
const PREFIX_CHASH  = PREFIX_MAGIC + 'chash';
const PREFIX_PUBKEY = PREFIX_MAGIC + 'pubkey';
const PREFIX_NAME   = PREFIX_MAGIC + 'name';
const PREFIX_ADDR0  = PREFIX_MAGIC + 'addr0'; 

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
		this.clear();
	}
	clear() {
		this._texts.clear();
		this._addrs.clear();
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
		} else if (xs?.[Symbol.iterator]) { // entries
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
		this._pubkey = v ? Pubkey.from(v).bytes : undefined;
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
	delete(key, silent) {
		this.set(key, undefined, silent); // convenience
	}
	*_entries(fn) {
		for (let [k, x] of this._texts) {
			yield [k, fn(x), SEL_TEXT];
		}
		for (let a of this.getAddresses()) {
			yield [PREFIX_COIN + a.coin.name, fn(a), SEL_ADDR];
		}
		let chash = this.getChash();
		if (chash) {
			yield [PREFIX_CHASH, fn(chash), SEL_CHASH];
		}
		let pubkey = this.getPubkey();
		if (pubkey) {
			yield [PREFIX_PUBKEY, fn(pubkey), SEL_PUBKEY];
		}
		let {_name} = this;
		if (_name) {
			yield [PREFIX_NAME, fn(_name), SEL_NAME];
		}
	}
	[Symbol.iterator]() {
		return this._entries(x => x);
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
	makeSetters({name, node = 0, addr0 = false, init = new Record()} = {}) {
		node = name ? namehash(name) : bytes32_from(node);
		let calls = [];
		for (let k of new Set([...init._texts.keys(), ...this._texts.keys()])) {
			let s0 = init._texts.get(k);
			let s1 = this._texts.get(k);
			if (s0 !== s1) {
				calls.push(abi_encode('iss', [node, k, s1 ?? ''], SEL_SET_TEXT));
			}
		}		
		for (let k of new Set([...init._addrs.keys(), ...this._addrs.keys()])) {
			let v0 = init._addrs.get(k);
			let v1 = this._addrs.get(k);
			if (!array_equals(v0, v1)) {
				if (addr0 && k == 60) {
					calls.push(abi_encode('ii', [node, k, v1 ? phex_from_bytes(v1) : 0], SEL_SET_ADDR0));
				} else {
					calls.push(abi_encode('iiv', [node, k, v1 ?? []], SEL_SET_ADDR));
				}
			}
		}
		if (!array_equals(init._chash, this._chash)) {
			calls.push(abi_encode('iv', [node, this._chash || []], SEL_SET_CHASH));
		}
		if (!array_equals(init._pubkey, this._pubkey)) {
			calls.push(abi_encode('ix', [node, this._pubkey || new Uint8Array(64)], SEL_SET_PUBKEY));
		}
		if (init._name !== this._name) {
			calls.push(abi_encode('is', [node, this._name || ''], SEL_SET_NAME));
		}
		return calls;
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
			this.chash  = !!x.chash || !!x.contentHash;
			this.pubkey = !!x.pubkey;
			this.name   = !!x.name;
			this.addr0  = !!x.addr0;
			//this.abi = !!x.abi;
		} else {
			throw error_with('unknown profile format', {profile: x});
		}
	}
	set(x, on = true) {
		if (is_string(x)) {
			if (x.startsWith(PREFIX_MAGIC)) {
				switch (x) {
					case PREFIX_CHASH:  this.chash  = on; break;
					case PREFIX_PUBKEY: this.pubkey = on; break;
					case PREFIX_NAME:   this.name   = on; break;
					case PREFIX_ADDR0:	this.addr0  = on; break;
					default: throw error_with('unknown property', {prop: x});
				}
			} else if (x.startsWith(PREFIX_COIN)) {
				this.setCoin(x.slice(PREFIX_COIN.length), on);
			} else {
				this.setText(x, on);
			}
		} else if (x?.[Symbol.iterator]) {
			for (let y of x) this.set(y, on);
		} else {
			this.setCoin(x, on);
		}
	}
	setText(x, on = true) {
		if (is_string(x)) {
			if (on) {
				this.texts.add(x);
			} else {
				this.texts.delete(x);
			}
		} else if (x?.[Symbol.iterator]) {
			for (let y of x) this.setText(y, on);
		} else {
			throw error_with('expected string', {value: x});
		}
	}
	setCoin(x, on = true) {
		if (!is_string(x) && x?.[Symbol.iterator]) {
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
	getCoins() {
		return Array.from(this.coins, x => Coin.fromType(x));
	}
	*[Symbol.iterator]() {
		yield* Array.from(this.texts);
		for (let x of this.coins) {
			yield Coin.fromType(x).name;
		}
		if (this.chash)  yield PREFIX_CHASH;
		if (this.pubkey) yield PREFIX_PUBKEY;
		if (this.name)   yield PREFIX_NAME;
		if (this.addr0)  yield PREFIX_ADDR0;
	}
	makeGetters({name, node = 0} = {}) {
		node = name ? namehash(name) : bytes32_from(node);
		let calls = [];
		for (let x of this.texts) {
			calls.push(abi_encode('is', [node, x], SEL_TEXT));
		}
		for (let x of this.coins) {
			calls.push(abi_encode('ii', [node, x], SEL_ADDR));
		}
		if (this.chash)  calls.push(abi_encode('i', [node], SEL_CHASH));
		if (this.pubkey) calls.push(abi_encode('i', [node], SEL_PUBKEY));
		if (this.name)   calls.push(abi_encode('i', [node], SEL_NAME));
		if (this.addr0)  calls.push(abi_encode('i', [node], SEL_ADDR0));
		return calls;
	}
	toJSON(hr) {
		let json = {
			texts: [...this.texts],
			coins: this.getCoins().map(x => x.toJSON(hr)),
		};
		json.chash  = this.chash;
		json.pubkey = this.pubkey;
		json.name   = this.name;
		json.addr0  = this.addr0;
		return json;
	}
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
