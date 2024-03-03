import {getCoderByCoinType, coinNameToTypeMap} from '@ensdomains/address-encoder';
import {bytes_from_phex, error_with} from './utils.js';

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
export class Coin {
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

