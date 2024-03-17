import {error_with} from './utils.js';
import {Record} from './Record.js';

const LABEL_SELF = '.';

function split(s) {
	return s ? s.split('.') : [];
}

export class Node extends Map {
	static root(name) {
		return new this(`[${name || 'root'}]`);
	}
	constructor(label, parent) {
		super();
		this.label = label;
		this.parent = parent || undefined;
		this.record = null;
	}
	get name() {
		if (!this.parent) return '';
		let v = [];
		for (let x = this; x.parent; x = x.parent) v.push(x.label);
		return v.join('.');
	}
	get depth() {
		let n = 0;
		for (let x = this; x.parent; x = x.parent) ++n;
		return n;
	}
	get nodes() {
		let n = 0;
		this.scan(() => ++n);
		return n;
	}
	// get node "a" from "a.b.c" or null
	// find("") is identity
	find(name) {
		return split(name).reduceRight((x, s) => x?.get(s), this);
	}
	// ensures the nodes for "a.b.c" exist and returns "a"
	create(name) {
		return split(name).reduceRight((x, s) => x.child(s), this);
	}
	// gets or creates a subnode of this node
	child(label) {
		let node = this.get(label);
		if (!node) {
			if (!label) throw new Error('empty label');
			node = new Node(label, this);
			this.set(label, node);
		}
		return node;
	}
	importJSON(json) {
		try {
			if (typeof json !== 'object' || Array.isArray(json)) throw new Error('expected object');
			let record = json[LABEL_SELF];
			this.record = Record.from(record || json);
			if (record) {
				for (let [ks, v] of Object.entries(json)) {
					if (ks === LABEL_SELF) continue; // skip record type
					ks = ks.trim();
					if (!ks) throw new Error('expected label');
					for (let k of ks.split(/\s+/)) {
						this.create(k).importJSON(v);
					}
				}
			}
		} catch (err) {
			throw error_with(`Importing "${this.name}": ${err.message}`, {json}, err);
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
