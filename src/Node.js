import {error_with, namesplit, namehash} from './utils.js';
import {Record} from './Record.js';
import {keccak_256} from '@noble/hashes/sha3';
import {ens_normalize, ens_beautify} from '@adraffy/ens-normalize';

const LABEL_SELF = '.';

export class Node extends Map {
	static create(name) {
		return this.root().create(name);
	}
	static root(tag) {
		return new this(`[${tag || 'root'}]`);
	}
	constructor(label, parent) {
		super();
		this.label = label;
		this.parent = parent || undefined;
		this.record = null;
	}
	get labelhash() {
		// note: root labelhash is undefined
		return this.parent ? keccak_256(this.label) : new Uint8Array(32);
	}
	get namehash() {
		return namehash(this.path().map(x => x.label));
	}
	get prettyName() {
		return ens_beautify(this.name);
	}
	get name() {
		return this.path().map(x => x.label).join('.');
	}
	get depth() {
		let n = 0;
		for (let x = this; x.parent; x = x.parent) ++n;
		return n;
	}
	get root() {
		let x = this;
		while (x.parent) x = x.parent;
		return x;
	}
	path(inc_root) {
		// raffy.eth => [raffy.eth, eth, <root>?]
		let v = [];
		for (let x = this; inc_root ? x : x.parent; x = x.parent) v.push(x);
		return v;
	}
	get nodeCount() {
		let n = 0;
		this.scan(() => ++n);
		return n;
	}
	// get node "a" from "a.b.c" or null
	// find("") is identity
	find(name) {
		return namesplit(name).reduceRight((x, s) => x?.get(s), this);
	}
	// ensures the nodes for "a.b.c" exist and returns "a"
	create(name) {
		return namesplit(name).reduceRight((x, s) => x.child(s), this);
	}
	// gets or creates a subnode of this node
	child(label) {
		if (!label) throw new Error('empty label');
		label = ens_normalize(label);
		if (label.includes('.')) throw error_with('expected single label', {label});
		let node = this.get(label);
		if (!node) {
			node = new Node(label, this);
			this.set(label, node);
		}
		return node;
	}
	import(obj) {
		// TODO should this support arrays?
		try {
			if (typeof obj !== 'object' || Array.isArray(obj)) throw new Error('expected object');
			let rest = [];
			for (let [k, v] of Object.entries(obj)) {
				if (k === LABEL_SELF) {
					this.record = Record.from(v);
				} else if (!Record.isSpecialKey(k) && v?.constructor === Object) {
					let ks = k.trim();
					if (!ks) throw new Error('expected label');
					for (let k of ks.split(/\s+/)) {
						this.create(k).import(v);
					}
				} else {
					rest.push([k, v]);
				}
			}
			if (rest.length) {
				if (!this.record) this.record = new Record();
				this.record.import(rest);
			}
		} catch (err) {
			throw error_with(`import "${this.name}": ${err.message}`, {json: obj}, err);
		}
	}
	toJSON() {
		if (this.record && !this.size) {
			return this.record.toJSON();
		}
		let json = {};
		if (this.record) {
			json[LABEL_SELF] = this.record.toJSON();
		}
		for (let [k, v] of this) {
			json[k] = v.toJSON();
		}
		return json;
	}
	scan(fn, level = 0) {
		fn(this, level++);
		for (let x of this.values()) {
			x.scan(fn, level);
		}
	}
	collect(fn) {
		let v = [];
		this.scan((x, n) => {
			let res = fn(x, n);
			if (res != null) v.push(res); // allow "" and false
		});
		return v;
	}
	flat() {
		return this.collect(x => x);
	}
	print() {
		this.scan((x, n) => {
			let line = '  '.repeat(n) + x.label;
			if (x.record) line += '*'; // label* => this node has a record
			if (x.size) line += ` (${x.size})`; // (#) => this node has subdomains
			console.log(line);
		});
	}
}
