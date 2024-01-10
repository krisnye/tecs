import { getArrayManager } from "./ArrayManager";
import { FromSchema, Schema } from "./Schema";
import { Uint32Schema } from "./schemas";
import { StringKeyof, WritableArrayLike } from "./types";

export type Entity = number
export interface Component<N extends string = string, S extends Schema = Schema> { readonly id: Entity; readonly name: N; readonly schema: S }
export interface Archetype<C extends ReadonlyArray<Component> = ReadonlyArray<Component>> { readonly components: C }
type FromComponent<C extends Component> = FromSchema<C["schema"]>
type ComponentName<T> = T extends Component ? T["name"] : never
type ComponentValueType<T> = T extends Component ? FromSchema<T["schema"]> : never
type FromComponents<C extends ReadonlyArray<Component>> = { [V in StringKeyof<C> as ComponentName<C[V]>]: ComponentValueType<C[V]> }
type CreateValues<C extends ReadonlyArray<Component>> = Omit<FromComponents<C>, "id">
type FromArchetype<A extends Archetype> = FromComponents<A["components"]>

export const coreComponents = {
    id: { id: 0, name: "id", schema: { type: "integer", minimum: 0 } },
    name: { id: 1, name: "name", schema: { type: "string" } },
    schema: { id: 2, name: "schema", schema: { type: "object" } }
} as const satisfies Record<string,Component>

type Row = number

type ComponentRows<C extends ReadonlyArray<Component>> = { [K in StringKeyof<C> as ComponentName<C[K]>]: WritableArrayLike<ComponentValueType<C[K]>> }

type ArchetypeId = number
interface ArchetypeTable<C extends ReadonlyArray<Component> = ReadonlyArray<Component>> extends Archetype<C> {

    readonly id: ArchetypeId
    readonly components: C
    readonly size: number
    readonly rows: ComponentRows<C>

    readonly addComponent: Map<Entity,ArchetypeTable>
    readonly removeComponent: Map<Entity,ArchetypeTable>

    createRow(values?: FromComponents<C>): Row
    deleteRow(row: Row): void

    forEachRow(callback: (size: number, rows: ComponentRows<C>, archetype: Archetype<C>) => void, includeSubArchetypes: boolean): void
}

function createArchetypeTable<C extends ReadonlyArray<Component>>(id: Entity, components: C): ArchetypeTable<C> {
    let size = 0
    let capacity = 4
    let managers = components.map(component => getArrayManager(component.schema))
    let rows: any = Object.fromEntries(components.map(((component, index) => [component.name, managers[index].create(capacity)])))
    const table: ArchetypeTable<C> = {
        id,
        components,
        get size() {
            return size
        },
        rows,
        addComponent: new Map(),
        removeComponent: new Map(),
        createRow(values?: FromComponents<C>) {
            if (size === capacity) {
                capacity *= 2
                for (let i = 0; i < components.length; i++) {
                    let component = components[i]
                    let manager = managers[i]
                    rows[component.name] = manager.resize(rows[component.name], capacity)
                }
            }

            if (values !== undefined) {
                for (let name in values) {
                    rows[name][size] = values[name]
                }
            }

            return size++
        },
        deleteRow(row: Row) {
            size--
            for (let name in rows) {
                let array = rows[name]
                array[row] = array[size]
            }
        },
        forEachRow(callback: (size: number, rows: ComponentRows<C>, archetype: Archetype<C>) => void, includeSubArchetypes: boolean): void {
            if (size > 0) {
                callback(size, rows, table)
            }
            if (includeSubArchetypes) {
                for (let subtype of this.addComponent.values()) {
                    subtype.forEachRow(callback as any, true)
                }
            }
        }

    }
    return table
}

export interface ECS {

    createComponent<N extends string, S extends Schema>(props: {name: N, schema: S}): Component<N,S>
    getArchetype<C extends ReadonlyArray<Component>>(components: C): Archetype<C>

    createEntity(): Entity
    createEntity<A extends Archetype>(archetype: A, values: CreateValues<A["components"]>): Entity
    deleteEntity(id: Entity): void

    getValue<C extends Component>(id: Entity, component: C): FromComponent<C> | undefined
    setValue<C extends Component>(id: Entity, component: C, value: FromComponent<C> | undefined): void

    readEntityAs<A extends Archetype>(archetype: A, id: Entity): FromArchetype<A> | undefined
    forEachEntity<A extends Archetype>(archetype: A, callback: (size: number, rows: ComponentRows<A["components"]>) => void): void

    toJson(): object
}

function ensureSorted(components: ReadonlyArray<Component>) {
    for (let i = 1; i < components.length; i++) {
        if (components[i - 1].name > components[i].name) {
            throw new Error("Components are not alphabetically sorted")
        }
    }
}

export function createECS(): ECS {

    const componentLookup = new Map<string,Component>()
    const recordManager = getArrayManager(Uint32Schema)
    let recordCount = 0
    let recordCapacity = 1024
    const elementsPerRecord = 2
    let records = recordManager.create(recordCapacity * elementsPerRecord)
    const root = createArchetypeTable(0, [])
    const archetypes: ArchetypeTable[] = [root]
    const getArchetypeLookupKey = (components: ReadonlyArray<Component>) => components.map(c => c.name).join(",")
    const archetypeLookup = new Map<string,ArchetypeTable>([[getArchetypeLookupKey(root.components) , root]])

    function getArchetype<C extends ReadonlyArray<Component>>(components: C): ArchetypeTable<C> {
        ensureSorted(components)
        const key = getArchetypeLookupKey(components)
        let archetable = archetypeLookup.get(key)
        if (!archetable) {
            archetable = createArchetypeTable(archetypes.length, components)
            archetypes.push(archetable)
            archetypeLookup.set(key, archetable)
        }
        return archetable as unknown as ArchetypeTable<C>
    }

    const componentArchetype = getArchetype([coreComponents.id, coreComponents.name, coreComponents.schema])

    function createComponent<N extends string,S extends Schema>({name, schema}: {name: N, schema: S}): Component<N,S> {
        if (componentLookup.has(name)) {
            throw new Error(`Component already exists ${name}`)
        }

        const entity = createEntity(componentArchetype, { name, schema })
        return readEntityAs(componentArchetype, entity) as Component<N,S>
    }


    function createEntity(): Entity
    function createEntity<A extends Archetype>(archetype: A, values: CreateValues<A["components"]>): Entity
    function createEntity<A extends Archetype>(archetype?: A, values?: CreateValues<A["components"]>): Entity {
        if (recordCount === recordCapacity) {
            recordCapacity *= 2
            records = recordManager.resize(records, recordCapacity * elementsPerRecord)
        }
        const id = recordCount++
        //  now put it directly into the archetype.
        const archetable = (archetype ?? archetypes[0]) as ArchetypeTable
        if (archetable.rows[coreComponents.id.name]) {
            (values as any)![coreComponents.id.name] = id
        }
        const row = archetable.createRow(values ?? {})

        //  now add the records entry
        const index = id * elementsPerRecord
        records[index + 0] = archetable.id
        records[index + 1] = row
        return id
    }
    function deleteEntity(id: Entity): void {
        const index = id * elementsPerRecord
        const archetable = archetypes[records[index + 0]]
        const row = records[index + 1]
        archetable.deleteRow(row)
    }

    function getValue<C extends Component>(id: Entity, component: C): FromComponent<C> | undefined {
        const index = id * elementsPerRecord
        const archetable = archetypes[records[index + 0]]
        const row = records[index + 1]
        const array = archetable.rows[component.name]
        if (array) {
            return array[row] as FromComponent<C>
        }
    }
    function getAdjacentArchetype(archetable: ArchetypeTable, component: Component, addOrRemove: "addComponent" | "removeComponent") {
        let newTable = archetable[addOrRemove].get(component.id)
        if (!newTable) {
            const add = addOrRemove === "addComponent"
            const newComponents = add
                ? [...archetable.components, component].sort()
                : archetable.components.filter(c => c.name !== component.name)
            newTable = getArchetype(newComponents)
            //  add the edge lookup to the new table
            archetable[addOrRemove].set(component.id, newTable)
            // also add the reverse edge direction.
            newTable[add ? "removeComponent" : "addComponent"].set(component.id, archetable)
        }
        return newTable
    }
    function setValue<C extends Component>(id: Entity, component: C, value: FromComponent<C> | undefined): void {
        const index = id * elementsPerRecord
        const archetable = archetypes[records[index + 0]]
        const currentRow = records[index + 1]
        const array = archetable.rows[component.name]
        if (value !== undefined) {
            if (array === undefined) {
                //  add component
                let newTable = getAdjacentArchetype(archetable, component, "addComponent")
                let newRow = newTable.createRow()
                //  manually move values over
                for (let c of archetable.components) {
                    newTable.rows[c.name] = archetable.rows[currentRow]
                }
                //  set the new component value
                newTable.rows[component.name][newRow] = value
                archetable.deleteRow(currentRow)
                records[index + 0] = newTable.id
                records[index + 1] = newRow
            }
            else {
                //  updating value
                array[currentRow] = value
            }
        }
        else if (array !== undefined) {
            //  remove component
            let newTable = getAdjacentArchetype(archetable, component, "removeComponent")
            let newRow = newTable.createRow()
            //  manually move values over, except for the removed one
            for (let c of archetable.components) {
                if (c.name !== component.name) {
                    newTable.rows[c.name] = archetable.rows[currentRow]
                }
            }
            archetable.deleteRow(currentRow)
            records[index + 0] = newTable.id
            records[index + 1] = newRow
        }
    }

    function readEntityAs<A extends Archetype>(archetype: A, id: Entity): FromArchetype<A> | undefined {
        const index = id * elementsPerRecord
        const archetable = archetypes[records[index + 0]]
        const row = records[index + 1]
        const values: any = {}
        for (let {name} of archetype.components) {
            const array = archetable.rows[name]
            if (!array) {
                return undefined
            }
            values[name] = array[row]
        }
        return values
    }
    function forEachEntity<A extends Archetype>(archetype: A, callback: (size: number, rows: ComponentRows<A["components"]>, archetype: A) => void): void {
        const archetable = archetype as unknown as ArchetypeTable
        archetable.forEachRow(callback as any, true)
    }
    function toJson(): object {
        return {
            entities: [...records.slice(0, recordCount * 2)],
            archetypes: Object.fromEntries(
                archetypes.filter(archetype => archetype.size).map(archetype => [
                    getArchetypeLookupKey(archetype.components),
                    Object.fromEntries(
                        Object.entries(archetype.rows).map(
                            ([name, array]) => [name, (array as any).slice(0, archetype.size)]
                        )
                    )
                ])
            )
        }
                
    }

    // prime the first 3 builtin components
    for (let component of Object.values(coreComponents) as Component[]) {
        const newComponent = createComponent(component)
        if (newComponent.id !== component.id) {
            throw new Error(`${newComponent.id} !== ${component.id}`)
        }
    }

    return {
        createComponent, getArchetype, createEntity, deleteEntity, getValue, setValue, readEntityAs, forEachEntity, toJson
    }
}
