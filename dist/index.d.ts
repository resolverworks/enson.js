type ToBigInt = number | string | BigInt;
type ToData = Uint8Array | number[] | string;

export class Pubkey {
	static from(value: ToData | {x: ToBigInt, y: ToBigInt}): Pubkey;
	static fromXY(x: ToBigInt, y: ToBigInt): Pubkey;
	constructor(v?: Uint8Array);
	set x(i: ToBigInt);
	set y(i: ToBigInt);
	get x(): Uint8Array;
	get y(): Uint8Array;
	get isNull(): boolean;
	get address(): string;
	toObject(): {x: Uint8Array, y: Uint8Array};
	toPhex(): string;
	toJSON(): {x: string, y: string};
}

type GatewayFn = (hash: string, spec: ChashSpec, data: Uint8Array) => string;
export class ChashSpec {
	readonly codec: number;
	readonly name: string;
	readonly scheme?: string;
	gateway?: GatewayFn;
}
export const Onion: ChashSpec | {
	fromPubkey(pubkey: ToData, version?: number): Uint8Array;
};
export const GenericURL: ChashSpec;
export const DataURL: ChashSpec;
export const IPFS: ChashSpec;
export const IPNS: ChashSpec;
export const Swarm: ChashSpec;
export const Arweave: ChashSpec;

export class Chash {
	static from(value: ToData, hint?: string): Chash;
	static fromParts(codec: number | ChashSpec, data: ToData): Chash;
	static fromOnion(hash: ToData): Chash;
	static fromBytes(raw: ToData): Chash;
	static fromURL(url: string | URL): Chash;
	constructor(v: Uint8Array);
	readonly bytes: Uint8Array;
	get codec(): number;
	get spec(): ChashSpec;
	get data(): Uint8Array;
	toHash(): string;
	toObject(): object;
	toEntry(): [key: string, value: string];
	toURL(): string;
	toGatewayURL(): string;
	toPhex(): string;
	toJSON(): string;
}

type CoinQuery = Coin | ToBigInt | {name?: string, type?: ToBigInt, chain?: number};
export class Coin {
	static get count(): number;
	static [Symbol.iterator](): IterableIterator<Coin>;
	static type(query: CoinQuery): bigint;	
	static from(query: CoinQuery): Coin;
	static fromType(type: ToBigInt): Coin;
	static fromName(name: string): Coin;
	static fromChain(chain: number): Coin;
	readonly type: bigint;
	get name(): string;
	get title(): string;
	get chain(): number | undefined;
	get isUnknown(): boolean;
	toObject(): {type: bigint, name: string, title: string, chain: number | undefined};
	parse(s: string): Uint8Array;
	format(v: Uint8Array): string;
}

export class Address {
	static from(value: ToData): Address;
	static from(query: CoinQuery, value: ToData): Address;
	readonly coin: Coin;
	readonly bytes: Uint8Array;
	get value(): string;
	toObject(): {
		coin: ReturnType<typeof Coin.prototype.toObject>; 
		value: string;
		bytes: Uint8Array;
	};
	toPhex(): string;
	toJSON(): string;
}

export class Profile {
	static from(x: Record): Profile;
		
	get size(): number;
	texts: Set<string>;
	coins: Set<Coin>;
	chash: boolean;
	pubkey: boolean;
	name: boolean;	
	addr0: boolean;

	clear(): void;
	setCoin(query: CoinQuery | CoinQuery[], on?: boolean): void;
	setText(key: string | string[], on?: boolean): void;
	import(record: Record): void;

	makeCallsForName(name: string): Uint8Array[];
	makeCalls(node: ToData): Uint8Array[];
}

type ManyRecords = Object | [any, any][];
type RecordEntry = [key: string, value: any, selector: number];
export class Record {
	static readonly CHASH: Symbol;
	static readonly PUBKEY: Symbol;
	static readonly NAME: Symbol;

	static from(records: ManyRecords): Record;
	get size(): number;
	
	set(key: any, value?: any): void;
	import(records: ManyRecords): void;

	setText(key: string, value?: string): void;
	setAddress(...args: Parameters<typeof Address.from>): void;
	setChash(...args: Parameters<typeof Chash.from>): void;
	setPubkey(...args: Parameters<typeof Pubkey.from>): void;
	setName(value?: string): void;

	getAddress(query: CoinQuery): Address | undefined;
	getChash(): Chash | undefined;
	getPubkey(): Pubkey | undefined;
	
	text(key: string): string | undefined;
	addr(type: Coin | number): Uint8Array | undefined;
	contenthash(): Uint8Array | undefined;
	pubkey(): Uint8Array | undefined;
	name(): string | undefined;

	[Symbol.iterator](): Generator<RecordEntry, void, unknown>;	
	toObject(): {[key: string]: any};
	toEntries(hr?: boolean): RecordEntry[];
	toJSON(hr?: boolean): {[key: string]: any};
}

export class Node extends Map {
	static root(name?: string): Node;
	constructor(label: string, parent?: Node);

	readonly label: string;
	readonly parent: Node;
	record?: Record;

	get name(): string;
	get depth(): number;
	get nodes(): number;

	find(name: string): Node | undefined;
	create(name: string): Node;
	child(label: string): Node;
	import(obj: Object): void;

	scan(fn: (node: Node, level: number) => void, level?: number): void;
	collect<T>(fn: (node: Node, level: number) => T | undefined): T[];
	flat(): Node[];
	print(): void;
}

// function error_with(message: string, options: Object, cause?: any): Error;
// function is_number(x: any): boolean;
// function is_string(x: any): boolean;
// function maybe_phex(x: any): boolean;
// function bytes_from_data(x: ToData): Uint8Array;
// function bytes32_from(x: ToBigInt | Uint8Array): Uint8Array;
