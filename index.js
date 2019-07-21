module.exports = (XRegExp) => {
    const __ = {
        pickBy(object, predicate) {
            const result = {};
            Object.keys(object).forEach(key => {
                const value = object[key];
                if(predicate(value, key)) {
                    result[key] = value;
                }
            });
            return result;
        },
        isNil(value) {
            return value == null;
        },
        isObject(value) {
            const type = typeof value;
            return value != null && (type === 'object' || type === 'function');
        },
        isFunction(value) {
            return typeof value === 'function'
        },
        isArray(value) {
            return Array.isArray(value);
        },
        mapValues(object, iteratee) {
            object = Object(object);
            const result = {};

            Object.keys(object).forEach(key => {
                result[key] = iteratee(object[key], key, object);
            });
            return result;
        },
        each(value, iteratee) {
            Object.keys(value).forEach(key => {
                iteratee(value[key], key, value);
            });
            return value;
        },
        values(object) {
            return Object.values(object);
        },
        map(value, iteratee) {
            return value && value.map(iteratee);
        },
        size(value) {
            return Array.isArray(value) ? value.length : Object.keys(value).length;
        },
        mergeWith(object, ...others) {
            if(others.length <= 1) {
                return object;
            }
            const customizer = others.pop();
            others.forEach(other => {
                Object.keys(other).forEach(key => {
                    let result = customizer(object[key], other[key], `${key}`, object, other);
                    if(result === undefined) {
                        result = other[key];
                    }
                    object[key] = result;
                })
            });
            return object;
        }
    };
    function cleanMatch(match) {
        return __.pickBy(match, (value, key) => !/^(\d+|index|input|groups)$/.test(key) && !__.isNil(value));
    }
    function mergeMatch(queue, values, parent = null) {
        return (match) => {
            match = __.mapValues(cleanMatch(match), (value, key) => ({ value, key, parent, self: null }));
            __.each(__.values(match), value => value.self = match);
            values.push(match);
            __.mergeWith(queue, match, (queueValue, matchValue) => (queueValue || []).concat(matchValue));
        };
    }
    function simplify(array) {
        return array.length == 1 ? array[0] : array;
    }
    function reduce(array) {
        return simplify(__.map(array, value => __.mapValues(value, entry => __.isArray(entry.value) ? reduce(entry.value) : entry.value)));
    }
    function backChain(entry, mainName) {
        let currentKey = entry.key;
        let keyChain = [currentKey];
        let paramArray = [entry.self];
        let paramArrays = [];
        while(entry.parent != null) {
            entry = entry.parent;
            if(entry.key == mainName) { paramArrays.push(paramArray); }
            paramArray = [__.mapValues(entry.self, (value, key) => key == currentKey ? { value: paramArray } : value)];
            currentKey = entry.key;
            keyChain.unshift(currentKey);
        }
        paramArrays.push(paramArray);
        return { paramArrays, keyChain };
    }
    XRegExp.matchNest = (string, mainName, nestPatterns) => {
        let queue = {};
        let base = [];
        XRegExp.forEach(string, XRegExp(nestPatterns[mainName]), mergeMatch(queue, base));
        while(__.size(queue) > 0) {
            let newQueue = {};
            __.each(queue, (queueValue, queueKey) => {
                __.each(queueValue, queueEntry => {
                    let pattern = nestPatterns[queueKey];
                    if(pattern && __.isFunction(pattern)) {
                        let { paramArrays, keyChain } = backChain(queueEntry, mainName);
                        pattern = pattern({ objects: __.map(paramArrays, reduce), keyChain });
                    }
                    if(pattern) {
                        let values = [];
                        XRegExp.forEach(queueEntry.value, XRegExp(pattern), mergeMatch(newQueue, values, queueEntry));
                        queueEntry.value = values;
                    }
                });
            });
            queue = newQueue;
        }
        return reduce(base);
    }
};