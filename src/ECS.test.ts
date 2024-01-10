import { createECS } from "./ECS";
import { assert } from "./assert";

console.log(JSON.stringify(createECS().toJson(), null, 2))

assert({
    given: "a new ECS",
    should: "have 3 builtin component entities, verified with toJSON",
    actual: createECS().toJson(),
    expected: {
    "entities": [
        1,
        0,
        1,
        1,
        1,
        2
    ],
    "archetypes": {
        "id,name,schema": {
        "id": [
            0,
            1,
            2
        ],
        "name": [
            "id",
            "name",
            "schema"
        ],
        "schema": [
            {
            "type": "integer",
            "minimum": 0
            },
            {
            "type": "string"
            },
            {
            "type": "object"
            }
        ]
        }
    }
    }
})

assert({
    given: "test",
    should: "work",
    actual: 10,
    expected: 10
})

{
    const ecs = createECS()
    const components = {
        mass: ecs.createComponent({ name: "mass", schema: { type: "number", minimum: 0 }}),
        // How to handle inline vector types like Vector3 with efficient inline storage?
        position: ecs.createComponent({ name: "mass", schema: { type: "number", minimum: 0 }}),
    }
}
