const clone = require('lodash/clone')
const uniq = require('lodash/uniq')
const ordering = require('stylint/src/data/ordering.json')

module.exports = function () {
    const list = clone(ordering.grouped)

    function insert(...items) {
        return {
            before: function (prop) {
                list.splice(list.indexOf(prop), 0, ...items)
            },
            after: function (prop) {
                list.splice(list.indexOf(prop) + 1, 0, ...items)
            }
        }
    }

    // See https://github.com/tj/nib/blob/master/docs/README.md
    insert('fixed', 'absolute', 'relative').before('position')
    insert('clearfix').before('clear')
    insert('image').before('background')
    insert('shadow-stroke').before('text-shadow')
    insert('size').before('width')
    insert('whitespace').before('white-space')
    insert('ellipsis').before('overflow')
    insert('backface-visibility').before('opacity')
    insert('user-select').after('user-zoom')

    return uniq(list)
}