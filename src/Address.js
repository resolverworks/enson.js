import {is_string, error_with, try_coerce_bytes, phex_from_bytes} from './utils.js';
import {Coin, ETH} from './Coin.js';

export class Address {
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
		return phex_from_bytes(this.bytes);
	}
	toString() {
		return this.value;
	}
	toJSON() {
		return this.value;
	}
}
