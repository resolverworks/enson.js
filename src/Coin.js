import {getCoderByCoinType, coinNameToTypeMap, coinTypeToNameMap} from '@ensdomains/address-encoder';
import {error_with, is_bigint, is_number, is_string, is_samecase_phex} from './utils.js';
import {bytesToHex, hexToBytes} from '@noble/hashes/utils';

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

// patch around strict parsing
const {encode: eth_encode, decode: eth_decode_checksum} = getCoderByCoinType(60);
function eth_decode(s) {
	return is_samecase_phex(s) && s.length == 42 ? hexToBytes(s.slice(2)) : eth_decode_checksum(s);
}

// TODO: should this be BigInt?
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
	static type(x) {
		if (is_bigint(x)) return x;
		if (is_number(x)) return BigInt(x);
		if (x instanceof Coin) return x.type;
		return Coin.from(x).type;
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
				if (decode === eth_decode_checksum) decode = eth_decode; // patch
				let names = coinTypeToNameMap[type];
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
			type = coinNameToTypeMap[name.toLowerCase()];
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

export class UnnamedCoin extends Coin {
	get isUnnamed() { return true; }
}

export class UnnamedEVMCoin extends UnnamedCoin {
	get name()  { return PREFIX_CHAIN + this.chain; }
	get title() { return 'Unknown Chain'; }
	parse(s)    { return eth_decode(s); }
	format(v)   { return eth_encode(v); }
}

export class UnknownCoin extends UnnamedCoin {
	get name()  { return PREFIX_UNKNOWN + this.type; }
	get title() { return 'Unknown Coin'; }
	parse(s)    { throw error_with('unknown parser', {coin: this, value: s}); }
	format(v)   { return `[0x${bytesToHex(v)}]`; }
	toObject() {
		let {type, title} = this;
		return {type, title};
	}
}

export const ETH = Coin.fromType(TYPE_ETH);
