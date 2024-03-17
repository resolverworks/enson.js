import {Coin} from './Coin.js';
import {Address} from './Address.js';
import {Chash} from './Chash.js';
import {Pubkey} from './Pubkey.js';
import {error_with, is_string, bytes32_from, utf8_from_bytes, bigUintAt, bytes_from} from './utils.js';
import {keccak_256} from '@noble/hashes/sha3';
import {createView, utf8ToBytes} from '@noble/hashes/utils';

const SEL_TEXT   = 0x59d1d43c; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=text%28bytes32%2Cstring%29&escape=1&encoding=utf8
const SEL_ADDR   = 0xf1cb7e06; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=addr%28bytes32%2Cuint256%29&escape=1&encoding=utf8
const SEL_CHASH  = 0xbc1c58d1; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=contenthash%28bytes32%29&escape=1&encoding=utf8
const SEL_PUBKEY = 0xc8690233; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=pubkey%28bytes32%29&escape=1&encoding=utf8
const SEL_NAME   = 0x691f3431; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=name%28bytes32%29&escape=1&encoding=utf8
const SEL_ADDR0  = 0x3b3b57de; // https://adraffy.github.io/keccak.js/test/demo.html#algo=evm&s=addr%28bytes32%29&escape=1&encoding=utf8

const PREFIX_COIN = '$';
const PREFIX_MAGIC = '#';
const PREFIX_CHASH  = PREFIX_MAGIC + 'chash';
const PREFIX_PUBKEY = PREFIX_MAGIC + 'pubkey';
const PREFIX_NAME   = PREFIX_MAGIC + 'name';

// TODO: add missing profiles, like ABI()

export class Record {	
	static from(xs, silent) {
		let r = new this();
		r.import(xs, silent);
		return r;
	}
	constructor() {
		this.map = new Map();
		this._chash = undefined;
		this._pubkey = undefined;
	}
	get size() {
		return this.map.size;
	}
	import(xs, silent) {
		if (Array.isArray(xs)) { 
			for (let [k, x] of xs) this.set(k, x, silent);
		} else {
			for (let [k, x] of Object.entries(xs)) this.set(k, x, silent);
		}
	}
	getChash() { return this._chash; }
	setChash(x, hint) {
		this._chash = x ? x instanceof Chash ? x : Chash.from(x, hint) : undefined;
	}
	getPubkey() { return this._pubkey; }
	setPubkey(x) {
		this._pubkey = x ? x instanceof Pubkey ? x : Pubkey.from(x) : undefined;
	}
	setName(x) {
		if (x && !is_string(x)) {
			throw error_with('unknown name', {name: x})
		}
		this._name = x || undefined;
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
		let m = [...this.map].map(([k, x]) => {
			if (is_string(k)) {
				return [k, fn(x), SEL_TEXT];
			} else {
				return [PREFIX_COIN + x.coin.name, fn(x), SEL_ADDR];
			}
		});
		let {_chash, _pubkey, _name} = this;
		if (_chash)  m.push([PREFIX_CHASH,  fn(_chash),  SEL_CHASH ]);
		if (_pubkey) m.push([PREFIX_PUBKEY, fn(_pubkey), SEL_PUBKEY]);
		if (_name)   m.push([PREFIX_NAME,   fn(_name),   SEL_NAME  ]);
		return m;
	}
	[Symbol.iterator]() {
		return this._entries(x => x)[Symbol.iterator]();
	}
	toEntries(hr) {
		let m = [];
		for (let [k, x] of this.map) {
			if (is_string(k)) {
				m.push([k, x]);
			} else {
				m.push([PREFIX_COIN + x.coin.name, x.value]);
			}
		}
		let {_chash, _pubkey, _name} = this;
		if (_chash) {
			if (hr) {
				let [short, value] = _chash.toEntry();
				m.push([short ? PREFIX_MAGIC + short : PREFIX_CHASH, value]);
			} else {
				m.push([PREFIX_CHASH, _chash.toPhex()]);
			}
		}
		if (_pubkey) {
			m.push([PREFIX_PUBKEY, hr ? _pubkey.toJSON() : _pubkey.toPhex()]);
		}
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
				case SEL_TEXT:   {
					let key = utf8_from_bytes(read_memory(call.subarray(4), 32));
					let value = utf8_from_bytes(read_memory(answer, 0));
					return this.setText(key, value);
				}
				case SEL_ADDR: {
					let v = read_memory(answer, 0);
					return this.setAddress(bigUintAt(calldata, 36), v.length && v);
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
	text(key)     { return this.map.get(key); }
	addr(type)    { return this.map.get(Coin.type(type))?.bytes; }
	contenthash() { return this._chash?.bytes; }
	pubkey()      { return this._pubkey?.bytes; }
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
			'email',
			'url',
			'avatar',
			'description',
			'notice',
			'keywords',
			'com.discord',
			'com.github',
			'com.reddit',
			'com.twitter',
			'org.telegram',
			'eth.ens.delegate'
		]);
		p.setCoin(['eth', 'btc', 'bnb', 'doge', 'ltc', 'dot', 'sol']);
		p.chash = true;
		p.pubkey = true;
		p.name = true;
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
			for (let k of x.map.keys()) {
				if (is_string(k)) {
					this.texts.add(k);
				} else {
					this.coins.add(k);
				}
			}
			this.chash  = !!x._chash;
			this.pubkey = !!x._pubkey;
			this.name   = !!x._name;
		} else if (x instanceof Profile) {
			x.texts.forEach(y => this.texts.add(y));
			x.coins.forEach(y => this.coins.add(y));
			this.chash  = x.chash;
			this.pubkey = x.pubkey;
			this.name   = x.name;
			this.addr0  = x.addr0;
		} else if (x && typeof x === 'object') {
			// https://github.com/ensdomains/ensjs-v3/blob/7e01ad8579c08b453fc64b1972b764b6d884b774/packages/ensjs/src/functions/public/getRecords.ts#L33
			if (Array.isArray(x.texts)) {
				this.setText(x.texts);
			}
			if (Array.isArray(x.coins)) {
				this.setText(x.coins);
			}
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
		return this.makeCalls(keccak_256(name));
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