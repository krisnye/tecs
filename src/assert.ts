import * as vitest from "vitest"

interface Assertion<T> {
    readonly given: any
    readonly should: string
    readonly actual: T
    readonly expected: T
}

export function assert<T>(a: Assertion<T>) {

    vitest.test(`Given ${a.given}, should: ${a.should}`, () => {
        vitest.expect(a.actual).toStrictEqual(a.expected)
    })

}