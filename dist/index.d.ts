type ToBigInt = number | string | bigint;
type ToData = Uint8Array | number[] | string;
type ToBytes32 = ToBigInt | ToData;
type ToName = string | string[];

export class Pubkey {
	static from(value: Pubkey | ToData | {x: ToBytes32, y: ToBytes32}): Pubkey;
	static fromXY(x: ToBytes32, y: ToBytes32): Pubkey;
	constructor(v?: Uint8Array);
	set x(i: ToBytes32);
	set y(i: ToBytes32);
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
	static from(value: Chash | ToData, hint?: string): Chash;
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
	static chain(query: CoinQuery): number | undefined;
	static from(query: CoinQuery): Coin;
	static fromType(type: ToBigInt): Coin;
	static fromName(name: string): Coin;
	static fromChain(chain: number): Coin;
	readonly type: bigint;
	get name(): string;
	get title(): string;
	get chain(): number | undefined;
	get legacy(): boolean | undefined;
	get unnamed(): boolean | undefined;
	parse(s: string): Uint8Array;
	format(v: Uint8Array): string;
	assertValid(v: Uint8Array): void;
	toObject(): {type: bigint, name: string, title: string, chain: number | undefined};
	toJSON(hr?: boolean): string;
}

export class Address {
	static from(value: Address | ToData): Address;
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
	static ENS(): Profile;
	static from(x: Record): Profile;
		
	get size(): number;
	texts: Set<string>;
	coins: Set<bigint>;
	chash: boolean;
	pubkey: boolean;
	name: boolean;	
	addr0: boolean;

	clear(): void;
	import(record: Record): void;
	set(key: any | any[], on?: boolean): void;
	setText(key: string | string[], on?: boolean): void;
	setCoin(query: CoinQuery | CoinQuery[], on?: boolean): void;
	getCoins(): Coin[];	
	[Symbol.iterator](): IterableIterator<string>;

	makeCallsForName(name: string): Uint8Array[];
	makeCalls(node: ToData): Uint8Array[];

	toJSON(): {
		texts: string[];
		coins: string[];
		chash: boolean;
		pubkey: boolean;
		name: boolean;
		addr0: boolean;
	};
}

type ManyRecords = Object | [any, any][];
type RecordEntry = [key: string, value: any, selector: number];
export class Record {
	static readonly CHASH: Symbol;
	static readonly PUBKEY: Symbol;
	static readonly NAME: Symbol;

	static isSpecialKey(key: any): boolean;

	static from(records: Record | ManyRecords): Record;
	get size(): number;
	
	set(key: any, value?: any): void;
	import(records: ManyRecords): void;

	setText(key: string, value?: string): void;
	setAddress(...args: Parameters<typeof Address.from>): void;
	setChash(...args: Parameters<typeof Chash.from>): void;
	setPubkey(...args: Parameters<typeof Pubkey.from>): void;
	setName(value?: string): void;
	parseCalls(calls: ToData[], answers: ToData[]): void;
	parseCall(call: ToData, answer: ToData): void;

	getTexts(): [key: string, value: string][];
	getAddresses(): Address[];
	getAddress(query: CoinQuery): Address | undefined;
	getChash(): Chash | undefined;
	getPubkey(): Pubkey | undefined;
	
	text(key: string): string | undefined;
	addr(type: Coin | number): Uint8Array | undefined;
	contenthash(): Uint8Array | undefined;
	pubkey(): Uint8Array | undefined;
	name(): string | undefined;

	[Symbol.iterator](): IterableIterator<RecordEntry>;
	toObject(): {[key: string]: any};
	toEntries(hr?: boolean): RecordEntry[];
	toJSON(hr?: boolean): {[key: string]: any};
}

export class Node extends Map {
	static create(name: ToName): Node;
	static root(tag?: string): Node;
	constructor(label: string, parent?: Node);

	readonly label: string;
	readonly parent: Node;
	record?: Record;

	get labelhash(): Uint8Array;
	get namehash(): Uint8Array;
	get dns(): Uint8Array;

	get prettyName(): string;
	get name(): string;

	get depth(): number;
	get nodeCount(): number;
	get root(): Node;
	path(includeRoot?: boolean): Node[];

	find(name: ToName): Node | undefined;
	create(name: ToName): Node;
	child(label: string): Node;
	import(obj: Object): void;

	scan(fn: (node: Node, level: number) => void, level?: number): void;
	collect<T>(fn: (node: Node, level: number) => T | undefined): T[];
	flat(): Node[];
	print(): void;
}

export function error_with(message: string, options: Object, cause?: any): Error;
export function namesplit(name: ToName): string[];
export function namehash(name: ToName): Uint8Array;
export function dns_encoded(name: ToName): Uint8Array;

// function is_number(x: any): boolean;
// function is_string(x: any): boolean;
// function maybe_phex(x: any): boolean;
// function bytes_from_data(x: ToData): Uint8Array;

export function bytes32_from(x: ToBytes32): Uint8Array;
export function try_coerce_bytes(x: ToData, no_phex?: boolean): Uint8Array;
