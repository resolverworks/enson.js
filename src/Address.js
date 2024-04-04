import {is_string, error_with, try_coerce_bytes, phex_from_bytes} from './utils.js';
import {Coin, ETH} from './Coin.js';

export class Address {
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
