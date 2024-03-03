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
		return new this(coin, v);
	}
	constructor(coin, bytes) {
		this.coin = coin;
		this.bytes = bytes;
	}
	get type() { return this.coin.type; }
	get name() { return this.coin.name; }
	toObject() {
		let {type, name, bytes} = this;
		return {type, name, value: this.toString(), bytes};
	}
	toPhex() {
		return phex_from_bytes(this.bytes);
	}
	toString() {
		let {coin, bytes} = this;
		return coin.encode(bytes);
	}
	toJSON() {
		return this.toString();
	}
}
