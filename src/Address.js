import {bytes_from_phex, phex_from_bytes} from './utils.js';
import {Coin} from './Coin.js';

export class Address {
	static from(x, s) {
		let coin = Coin.from(x);
		return new this(coin, coin.decode(s));
	}
	static fromParts(type, x) {
		let coin = Coin.fromType(type);
		let v = bytes_from_phex(x);
		coin.encode(v); // validate
		if (v === x) v = v.slice();
		return new this(coin, v);
	}
	constructor(coin, bytes) {
		this.coin = coin;
		this.bytes = bytes;
	}
	get type() { return this.coin.type; }
	get name() { return this.coin.name; }
	get value() { 
		let {coin, bytes} = this;
		return coin.encode(bytes);
	}
	toObject() {
		let {type, name, value, bytes} = this;
		return {type, name, value, bytes};
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
