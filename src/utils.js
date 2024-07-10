import {bytesToHex, hexToBytes, utf8ToBytes, createView} from '@noble/hashes/utils';
import {keccak_256} from '@noble/hashes/sha3';

export function namesplit(x) {
	return Array.isArray(x) ? x : x ? x.split('.') : [];
}

export function namehash(name) {
	return namesplit(name).reduceRight((v, x) => {
		v.set(keccak_256(x), 32);
		v.set(keccak_256(v), 0);
		return v;
	}, new Uint8Array(64)).slice(0, 32);
}

export function dns_encoded(name) {
	let labels = namesplit(name);
	let m = labels.map(label => {
		let v = utf8ToBytes(label);
		if (!v.length) throw error_with('empty label', {labels});
		if (v.length > 255) throw error_with('too long', {labels, label});
		return v;
	});
	let dns = new Uint8Array(m.reduce((a, v) => a + 1 + v.length, 1));
	let pos = 0;
	for (let v of m) {
		dns[pos++] = v.length;
		dns.set(v, pos); pos += v.length;
	}
	return dns;
}

export function error_with(message, options, cause) {
	let error;
	if (cause) {
		error = new Error(message, {cause});
		if (!error.cause) error.cause = cause;
	} else {
		error = new Error(message);
	}
	return Object.assign(error, options);
}

export function is_number(x) {
	return typeof x === 'number';
}
export function is_string(x) {
	return typeof x === 'string';
}
export function is_bigint(x) {
	return typeof x === 'bigint';
}

export function is_samecase_phex(s) {
	return is_string(s) && /^0x([0-9A-F]*|[0-9a-f]*)/i.test(s);
}

export function bytes_from(x, copy = true) {
	if (x instanceof Uint8Array) {
		return copy ? x.slice() : x;
	}
	let v = try_coerce_bytes(x);
	if (v !== x) return v;
	throw error_with('expected bytes-like', {value: x});
}

// always !== if successful (returns a copy)
export function try_coerce_bytes(x, no_phex) {
	if (x instanceof Uint8Array) {
		return x.slice();
	} else if (Array.isArray(x)) {
		return Uint8Array.from(x);
	} else if (!no_phex && is_samecase_phex(x)) {
		return hexToBytes(x.slice(2)); // throws if odd-length
	} else {
		return x;
	} 
}

export function utf8_from_bytes(v) {
	return new TextDecoder().decode(v);
}

export function bytes32_from(x) {
	x = try_coerce_bytes(x, true);
	if (x instanceof Uint8Array) {
		if (x.length !== 32) throw error_with('expected 32-bytes', {value: x});
		return x;
	}
	return hexToBytes(BigInt(x).toString(16).padStart(64, '0').slice(-64));
}

export function phex_from_bytes(v) {
	return '0x' + bytesToHex(v);
}

export function bigint_at(v, i) {
	return BigInt(phex_from_bytes(v.subarray(i, i + 32)));
}

export function array_equals(a, b) {
	if (!a) return !b;
	//if (a === b) return true;
	let n = a.length;
	let c = b.length === n;
	for (let i = 0; c && i < n; i++) c = a[i] === b[i];
	return c;
}

// s = string, v = bytes, i = address|number|uint256|bool, x = hex|Uint8Array(x32)
export function abi_encode_call(selector, types, values) {
	let m = values.map((v, i) => {
		let ty = types[i];
		if (ty === 's') {
			ty = 'v';
			v = utf8ToBytes(v);
		}
		if (ty === 'v') {
			let tail = new Uint8Array((1 + Math.ceil(v.length / 32)) << 5);
			createView(tail).setUint32(28, v.length);
			tail.set(v, 32);
			return [true, tail];
		} else if (ty === 'i') {
			return [false, bytes32_from(v)];
		} else if (ty === 'x') {
			let u = bytes_from(v, false);
			if (u.length & 31) throw error_with('ragged bytes', {value: v});
			return [false, u];
		} else {
			throw error_with('unknown type', {type: ty, value: v});
		}
	});
	let buf = new Uint8Array(m.reduce((a, [b, v]) => a + v.length + (b ? 32 : 0), 4));
	let dv = createView(buf);
	dv.setUint32(0, selector);
	let pos = 4;
	let ptr = m.reduce((a, [b, v]) => a + (b ? 32 : v.length), 0);
	for (let [b, v] of m) {
		if (b) {
			dv.setUint32(pos + 28, ptr); pos += 32;
			buf.set(v, ptr + 4); ptr += v.length;
		} else {
			buf.set(v, pos); pos += v.length;
		}
	}
	return buf;
}
