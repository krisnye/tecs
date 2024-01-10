import { FromSchema, Schema } from "./Schema"
import { WritableArrayLike } from "./types"

export interface ArrayManager<T> {
    create(capacity: number):  WritableArrayLike<T>
    resize(array: WritableArrayLike<T>, capacity: number): WritableArrayLike<T>
}

export function getArrayManager<S extends Schema>(s: S): ArrayManager<FromSchema<S>> {
    return {
        create(_capacity) {
            return []
        },
        resize(array, _capacity) {
            return array
        }
    }
}
