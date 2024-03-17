import {is_samecase_phex, bytes32_from, error_with, phex_from_bytes} from './utils.js';
import {ETH} from './Coin.js';
import {keccak_256} from '@noble/hashes/sha3';
import {hexToBytes, bytesToHex} from '@noble/hashes/utils';

// https://github.com/ethereum/EIPs/pull/619/files/9977cf4c2646b46f367e458a939888f93499990c#diff-5692e3f9c0bdb6bf2dbacbdec7059b3d70fcec8a12da584e598dff53e020cf93

export class Pubkey {
	static fromXY(x, y) {
		let self = new this();
		self.x = x;
		self.y = y;
		return self;
	}
	static from(value) {
		if (!value) return new this();
		try {
			if (value instanceof Uint8Array) {
				return new this(value);
			} else if (is_samecase_phex(value)) {
				return new this(hexToBytes(value.slice(2)));
			} else if (typeof value === 'object') {
				return this.fromXY(value.x, value.y);
			} 
			throw new Error('unknown format');
		} catch (err) {
			throw error_with('invalid pubkey', {value}, err);
		}
	}
	constructor(v) {
		if (v) {
			if (v instanceof Uint8Array && v.length == 64) {
				this.bytes = v.slice();
			} else {
				throw error_with('expected 64 bytes', {bytes: v});
			}
		} else {
			this.bytes = new Uint8Array(64);
		}
	}
	get isNull() { return this.bytes.every(x => x == 0); }
	set x(x) { this.bytes.set(bytes32_from(x)); }
	set y(x) { this.bytes.set(bytes32_from(x), 32); }
	get x() { return this.bytes.slice(0, 32); }
	get y() { return this.bytes.slice(32); }
	get address() { 
		return ETH.format(keccak_256(this.bytes).subarray(-20)); // should this be Address()? 
	}
	toObject() {
		let {x, y, address} = this;
		return {x, y, address};
	}
	toPhex() {
		return phex_from_bytes(this.bytes);
	}
	toJSON() {
		let v = this.bytes;
		return {
			x: short_phex(v.subarray(0, 32)), // this needed?
			y: short_phex(v.subarray(32))
		};
	}
}

function short_phex(v) {
	return bytesToHex(v).replace(/^0+(?!$)/, '0x');
}
