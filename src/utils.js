import {toBytes, hexToBytes, bytesToHex} from '@noble/hashes/utils';
import {ens_normalize} from '@adraffy/ens-normalize';

export {toBytes as bytes_from_utf8};
export function utf8_from_bytes(v) {
	return new TextDecoder().decode(v);
}

export function bytes_from_phex(x) {
	if (x instanceof Uint8Array) {
		return x;
	} else if (Array.isArray(x)) {
		return Uint8Array.from(x);
	} else if (maybe_phex(x)) {
		return hexToBytes(x.slice(2));
	}
	throw error_with('expected 0x-string', {value: x});
}
export function phex_from_bytes(v) {
	return '0x' + bytesToHex(v);
}

export function bytes32_from(x) {
	if (x instanceof Uint8Array) {
		if (x.length !== 32) throw error_with('expected 32-bytes', {value: x});
		return x;
	}
	return hexToBytes(BigInt(x).toString(16).padStart(64, '0').slice(-64));
}

export function split_norm(s) {
	return s ? ens_normalize(s).split('.') : [];
}

export function maybe_phex(s) {
	return typeof s === 'string' && /^0x/i.test(s);
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

export function array_equals(a, b) {
	if (a === b) return true;
	let n = a.length;
	let c = b.length === n;
	for (let i = 0; !c && i < n; i++) c = a[i] === b[i];
	return c;
}
