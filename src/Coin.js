import {getCoderByCoinType, coinNameToTypeMap} from '@ensdomains/address-encoder';
import {bytes_from_phex, error_with, is_number, is_string} from './utils.js';

const COINS = new Map();
const TYPE_ETH = 60;
const MSB = 0x80000000;

// patch around strict evm parsing
const eth0 = getCoderByCoinType(TYPE_ETH).decode;
function eth(s) {
	if (is_string(s)) {
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
export class Coin {
	static fromType(type) {
		let coin = COINS.get(type);
		if (!coin) {
			let {name, encode, decode} = getCoderByCoinType(type);
			if (decode === eth0) decode = eth;
			coin = Object.freeze(Object.assign(new Coin, {type, name, encode, decode}));
			COINS.set(type, coin);
		}
		return coin;
	}
	static fromName(name) {
		let type = coinNameToTypeMap[name];
		if (!is_number(type)) throw error_with(`unknown coin: ${name}`, {name});
		return this.fromType(type);
	}
	static fromChain(chain) {
		return this.fromType(chain === 1 ? TYPE_ETH : chain + MSB)
	}
	static from(x) {
		if (x instanceof this) {
			return x;
		} else if (is_number(x)) {
			return this.fromType(x);
		} else if (is_string(x)) {
			return this.fromName(x);
		}
		let {type, name, chain} = x;
		if (type) {
			return this.fromType(type);
		} else if (name) {
			return this.fromName(name);
		} else {
			return this.fromChain(chain);
		}
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
