require('module-alias/register')
require('source-map-support').install()

import 'mocha'

import { Client, Server, Type } from '@source'

import { expect } from 'chai'

/**
 * Integration tests for a single user (online and offline).
 */
describe('A single user', () => {
  it('can create and edit data online', () => {
    const server = new Server()
    const client = new Client(server)

    // Assorted edits.
    client.createRow('ABC')
    client.createRow('DEF')
    client.createColumn('123', Type.Text)
    client.createColumn('456', Type.Number)
    client.updateTextCellValue('ABC', '123', 'foo')
    client.updateNumberCellValue('ABC', '456', 1)
    client.updateNumberCellValue('DEF', '456', 2)
    client.updateColumnType('456', Type.Text) // Type coercion.
    client.updateTextCellValue('ABC', '456', '3')

    // Client has stayed online; changes sync instantly.
    expect(client.getData()).to.equal(server.getData())
    expect(JSON.parse(client.getData())).to.deep.equal({
      'columns': [
        { 'id': '123', 'type': 'text' },
        { 'id': '456', 'type': 'text' }
      ],
      'rows': [
        {
          'id': 'ABC',
          'cellValuesByColumnId': {
            '123': 'foo',
            '456': '3'
          }
        },
        {
          'id': 'DEF',
          'cellValuesByColumnId': {
            '456': '2'
          }
        }
      ]
    })
  })

  it('can create and edit data offline', () => {
    const server = new Server()
    const client = new Client(server)

    // Assorted edits.
    client.createRow('ABC')
    client.createRow('DEF')
    client.createColumn('123', Type.Text)
    client.createColumn('456', Type.Number)
    client.updateTextCellValue('ABC', '123', 'foo')
    client.updateNumberCellValue('ABC', '456', 1)

    client.goOffline()
    // Client goes offline; verify states are equal.
    expect(client.getData()).to.equal(server.getData())
    expect(JSON.parse(client.getData())).to.deep.equal({
      'columns': [
        { 'id': '123', 'type': 'text' },
        { 'id': '456', 'type': 'number' }
      ],
      'rows': [
        {
          'id': 'ABC',
          'cellValuesByColumnId': {
            '123': 'foo',
            '456': 1
          }
        },
        {
          'id': 'DEF',
          'cellValuesByColumnId': {}
        }
      ]
    })

    // More assorted edits (same as above)
    client.updateNumberCellValue('DEF', '456', 2)
    client.updateColumnType('456', Type.Text) // Type coercion.
    client.updateTextCellValue('ABC', '456', '3')
    client.destroyColumn('123')

    // Client is offline; changes should not be reflected server-side.
    expect(client.getData()).not.to.equal(server.getData())

    client.comeOnline()
    // Client back online; verify that changes have synced.
    expect(client.getData()).to.equal(server.getData())
    expect(JSON.parse(client.getData())).to.deep.equal({
      'columns': [
        { 'id': '456', 'type': 'text' }
      ],
      'rows': [
        {
          'id': 'ABC',
          'cellValuesByColumnId': {
            '456': '3'
          }
        },
        {
          'id': 'DEF',
          'cellValuesByColumnId': {
            '456': '2'
          }
        }
      ]
    })
  })

  it('does not induce dependent updates after a failure', () => {
    const server = new Server()
    const client = new Client(server)

    // Assorted edits.
    client.createRow('ABC')
    client.createRow('DEF')
    client.createColumn('123', Type.Text)
    client.updateTextCellValue('ABC', '123', 'foo')
    client.goOffline()

    // Client offline; updates will be batched.
    client.updateColumnType('123', Type.Number) // Failed coercion!
    client.updateTextCellValue('ABC', '123', 'bar') // Fails: dependent!

    client.comeOnline()
    // Messages transact; now group ID should change.
    client.updateTextCellValue('DEF', '123', 'baz') // Succeeds!

    // Client back online; verify that changes have synced.
    expect(client.getData()).to.equal(server.getData())
    expect(JSON.parse(client.getData())).to.deep.equal({
      'columns': [
        { 'id': '123', 'type': 'text' }
      ],
      'rows': [
        {
          'id': 'ABC',
          'cellValuesByColumnId': {
            '123': 'foo' // Not bar!
          }
        },
        {
          'id': 'DEF',
          'cellValuesByColumnId': {
            '123': 'baz'
          }
        }
      ]
    })
  })
})
