import { simple } from "acorn-walk";
import { parse } from "acorn";

const cleaner = async (code: string) => {

    const parsed = parse(code, {
        ecmaVersion: 2022,
    });

    console.log("Parsing finished, starting to find freeze calls...");

    const checkRoutes = [["BILLING_PREFIX", "/billing"], ["FRIENDS", "/channels/@me"], ["LOGIN", "/login"], ["ACTIVITIES", "/activities"], ["USERS", "/users"], ["ME", "/users/@me"]];
    const freezeCalls: {
        start: number;
        end: number
    }[] = []

    simple(parsed, {
        CallExpression: (node) => {
            if (node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier" && node.callee.property.name === "freeze") {
                if (node.arguments[0]?.type === "ObjectExpression") {
                    const args = node.arguments[0];

                    const isCorrectObject = args.properties.some((prop) => {
                        if (prop.type !== "Property") return false;
                        
                        return checkRoutes.some((stuff) => {
                            if (prop.key.type !== "Identifier" || prop.value.type !== "Literal") return false;

                            return stuff[0] === prop.key.name && stuff[1] === prop.value.value;
                        })
                    });

                    if (isCorrectObject) {
                        freezeCalls.push({
                            start: node.start,
                            end: node.end
                        });
                    }
                }
            }
        }
    })

    let start = -1;
    let end = -1;

    for (const frozen of freezeCalls) {
        if (start === -1) {
            start = frozen.start;
        }

        end = frozen.end;
    }

    const cleaned = code.slice(start, end);

    return cleaned;
}

export default cleaner;