import {bytesToHex, hexToBytes} from '@noble/hashes/utils';

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
	return is_string(s) && /^0x([0-9A-F]+|[0-9a-f]+)/i.test(s);
}

export function bytes_from(x, copy = true) {
	if (x instanceof Uint8Array) {
		return copy ? x.slice() : x;
	}
	let v = try_coerce_bytes(x);
	if (v !== x) return v;
	throw error_with('expected bytes-like', {value: x});
}

// always !== if successful
export function try_coerce_bytes(x) {
	if (x instanceof Uint8Array) {
		return x.slice();
	} else if (is_samecase_phex(x)) {
		return hexToBytes(x.slice(2));
	} else if (Array.isArray(x)) {
		return Uint8Array.from(x);
	} else {
		return x;
	} 
}

export function utf8_from_bytes(v) {
	return new TextDecoder().decode(v);
}

export function bytes32_from(x) {
	if (x instanceof Uint8Array) {
		if (x.length !== 32) throw error_with('expected 32-bytes', {value: x});
		return x.slice();
	}
	return hexToBytes(BigInt(x).toString(16).padStart(64, '0').slice(-64));
}

export function bigUintAt(v, i) {
	return BigInt(bytesToHex(v.subarray(i, i + 32)));
}

export function array_equals(a, b) {
	if (a === b) return true;
	let n = a.length;
	let c = b.length === n;
	for (let i = 0; !c && i < n; i++) c = a[i] === b[i];
	return c;
}
