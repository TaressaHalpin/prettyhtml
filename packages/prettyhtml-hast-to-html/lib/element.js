'use strict'

var xtend = require('xtend')
var svg = require('property-information/svg')
var find = require('property-information/find')
var spaces = require('space-separated-tokens').stringify
var commas = require('comma-separated-tokens').stringify
var entities = require('stringify-entities')
var all = require('./all')
var constants = require('./constants')
const repeat = require('repeat-string')

module.exports = element

/* Constants. */
var EMPTY = ''

/* Characters. */
var SPACE = ' '
var DQ = '"'
var SQ = "'"
var EQ = '='
var LT = '<'
var GT = '>'
var SO = '/'
var LF = '\n'

/* Stringify an element `node`. */
function element(ctx, node, index, parent) {
  var parentSchema = ctx.schema
  var name = node.tagName
  var value = ''
  var selfClosing
  var close
  var omit
  var root = node
  var content
  var attrs
  var collapseAttr = node.data ? node.data.collapseAttr : false
  var indentLevel = node.data ? node.data.indentLevel : 0

  if (parentSchema.space === 'html' && name === 'svg') {
    ctx.schema = svg
  }

  attrs = attributes(ctx, node.properties, collapseAttr, indentLevel)

  if (ctx.schema.space === 'svg') {
    omit = false
    close = true
    selfClosing = ctx.closeEmpty
  } else {
    omit = ctx.omit
    close = ctx.close
    selfClosing = ctx.voids.indexOf(name.toLowerCase()) !== -1

    // if (name === 'template') {
    //   root = node.content
    // }
  }

  content = all(ctx, root)

  // check for 'selfClosing' property of parse5
  if (node.data && selfClosing === false) {
    selfClosing = !!node.data.selfClosing
  }

  /* If the node is categorised as void, but it has
   * children, remove the categorisation.  This
   * enables for example `menuitem`s, which are
   * void in W3C HTML but not void in WHATWG HTML, to
   * be stringified properly. */
  selfClosing = content ? false : selfClosing

  if (attrs || !omit || !omit.opening(node, index, parent)) {
    value = LT + name

    if (attrs) {
      if (collapseAttr) {
        value += attrs
      } else {
        value += SPACE + attrs
      }
    }

    if (selfClosing && close) {
      if (!ctx.tightClose || attrs.charAt(attrs.length - 1) === SO) {
        value += SPACE
      }

      value += SO
    }

    // allow any element to selfclose itself except known HTML void elements
    if (selfClosing && ctx.voids.indexOf(name.toLowerCase()) === -1) {
      value += SO
    }

    value += GT
  }

  value += content

  if (!selfClosing && (!omit || !omit.closing(node, index, parent))) {
    value += LT + SO + name + GT
  }

  ctx.schema = parentSchema

  return value
}

/* Stringify all attributes. */
function attributes(ctx, props, collapseAttr, indentLevel) {
  var values = []
  var key
  var value
  var result
  var length
  var index
  var last

  for (key in props) {
    value = props[key]

    if (value == null) {
      continue
    }

    result = attribute(ctx, key, value)

    if (result) {
      values.push(result)
    }
  }

  length = values.length
  index = -1

  while (++index < length) {
    result = values[index]
    last = null

    if (ctx.schema.space === 'html' && ctx.tight) {
      last = result.charAt(result.length - 1)
    }

    /* In tight mode, don’t add a space after quoted attributes. */
    if (last !== DQ && last !== SQ) {
      if (collapseAttr) {
        values[index] = LF + repeat(ctx.tabWidth, indentLevel + 1) + result
      } else if (index !== length - 1) {
        values[index] = result + SPACE
      } else {
        values[index] = result
      }
    }
  }

  return values.join(EMPTY)
}

/* Stringify one attribute. */
function attribute(ctx, key, value) {
  var schema = ctx.schema
  var info = find(schema, key)
  var name = info.attribute

  if (
    value == null ||
    (typeof value === 'number' && isNaN(value)) ||
    (value === false && info.boolean)
  ) {
    return EMPTY
  }

  name = attributeName(ctx, name)

  if (
    (value === true && info.boolean) ||
    (value === true && info.overloadedBoolean)
  ) {
    return name
  }

  return name + attributeValue(ctx, key, value, info)
}

/* Stringify the attribute name. */
function attributeName(ctx, name) {
  // Always encode without parse errors in non-HTML.
  var valid = ctx.schema.space === 'html' ? ctx.valid : 1
  var subset = constants.name[valid][ctx.safe]

  return entities(name, xtend(ctx.entities, { subset: subset }))
}

/* Stringify the attribute value. */
function attributeValue(ctx, key, value, info) {
  var quote = ctx.quote

  if (typeof value === 'object' && 'length' in value) {
    /* `spaces` doesn’t accept a second argument, but it’s
     * given here just to keep the code cleaner. */
    value = (info.commaSeparated ? commas : spaces)(value, {
      padLeft: !ctx.tightLists
    })
  }

  value = String(value)

  if (value !== '') {
    value = EQ + quote + value + quote
  }

  return value
}
