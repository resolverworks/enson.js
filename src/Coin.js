import {getCoderByCoinType, coinNameToTypeMap, coinTypeToNameMap} from '@ensdomains/address-encoder';
import {error_with, is_bigint, is_number, is_string, phex_from_bytes, array_equals} from './utils.js';

const COINS = new Map();
const TYPE_ETH = 60n;
const MSB = 0x80000000n;
const PREFIX_CHAIN = 'chain:';
const PREFIX_UNKNOWN = '#';

function init() {
	if (COINS.init) return;
	COINS.init = true;
	for (let x of Object.values(coinNameToTypeMap)) {
		Coin.fromType(x);
	}
}

const {encode: eth_encode, decode: eth_decode} = getCoderByCoinType(60);
// 20240610: fixed https://github.com/ensdomains/address-encoder/issues/400
// // patch around strict parsing
// const {encode: eth_encode, decode: eth_decode_checksum} = getCoderByCoinType(60);
// function eth_decode(s) {
// 	return is_samecase_phex(s) && s.length == 42 ? hexToBytes(s.slice(2)) : eth_decode_checksum(s);
// }

export class Coin {
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
					coder = getCoderByCoinType(Number(type));
				}
			} catch (err) {
			}
			if (coder) {
				let {encode, decode} = coder;
				//if (decode === eth_decode_checksum) decode = eth_decode; // patch
				let names = coinTypeToNameMap[type];
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
			type = coinNameToTypeMap[key];
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
	toJSON(hr) {
		return hr ? this.name : '0x' + this.type.toString(16);
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

export class UnnamedCoin extends Coin {
	get unnamed() { return true; }
}

export class UnnamedEVMCoin extends UnnamedCoin {
	get name()  { return PREFIX_CHAIN + this.chain; }
	get title() { return 'Unknown Chain Coin'; }
	parse(s)    { return eth_decode(s); }
	format(v)   { return eth_encode(v); }
}

export class UnknownCoin extends UnnamedCoin {
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

export const ETH = Coin.fromType(TYPE_ETH);
