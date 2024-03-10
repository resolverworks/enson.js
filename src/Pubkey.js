import {phex_from_bytes, bytes_from_phex, bytes32_from, error_with, is_string} from './utils.js';
import {eth} from '@ensdomains/address-encoder/coins';
import {keccak_256} from '@noble/hashes/sha3';

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
			} else if (is_string(value)) {
				return new this(bytes_from_phex(value));
			} else if (typeof value === 'object') {
				return this.fromXY(value.x, value.y);
			} 
			throw new Error('unknown value');
		} catch (err) {
			throw error_with('invalid pubkey format', {value}, err);
		}
	}
	constructor(bytes) {
		let v = new Uint8Array(64);
		if (bytes) {
			if (bytes.length != 64) {
				throw error_with('expected 64 bytes', {bytes});
			}
			v.set(bytes);
		}
		this.bytes = v;
	}
	set x(x) { this.bytes.set(bytes32_from(x), 0); }
	set y(x) { this.bytes.set(bytes32_from(x), 32); }
	get x() { return this.bytes.slice(0, 32); }
	get y() { return this.bytes.slice(32); }
	get address() { return eth.encode(keccak_256(this.bytes).subarray(-20)); }
	toObject() {
		let {x, y, address} = this;
		return {x, y, address};
	}
	toJSON() {
		return {
			x: drop_zeros(phex_from_bytes(this.x)),
			y: drop_zeros(phex_from_bytes(this.y))
		};
	}
}

function drop_zeros(s) {
	return s.replace(/^0x0+/, '0x');
}
