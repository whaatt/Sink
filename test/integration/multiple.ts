require('module-alias/register')
require('source-map-support').install()

import 'mocha'

import { Client, Server, Type } from '@source'

import { expect } from 'chai'

/**
 * Integration tests for multiple users (online and offline).
 */
describe('Multiple users', () => {
  it('can create and edit data online', () => {
    const server = new Server()
    const clientA = new Client(server)
    const clientB = new Client(server)

    // Assorted edits.
    clientA.createRow('ABC')
    clientA.createRow('DEF')
    clientB.createRow('GHI')
    clientA.createColumn('123', Type.Text)
    clientA.createColumn('456', Type.Text)
    clientA.updateTextCellValue('DEF', '123', 'foo')
    clientB.updateTextCellValue('ABC', '456', 'baz')
    clientA.updateTextCellValue('ABC', '456', 'bar')

    // Throw in some complex semantics around failed type coercion. The type
    // update will fail if coercion fails, but succeeds if coercion succeeds.
    clientA.updateColumnType('123', Type.Number) // Fails!
    clientB.updateTextCellValue('DEF', '123', '0')
    clientB.updateColumnType('123', Type.Number)
    clientA.destroyRow('GHI')

    // All three nodes are online, so equality should hold.
    expect(clientA.getData()).to.equal(server.getData())
    expect(clientB.getData()).to.equal(server.getData())
    expect(JSON.parse(clientA.getData())).to.deep.equal({
      'columns': [
        { 'id': '123', 'type': 'number' },
        { 'id': '456', 'type': 'text' }
      ],
      'rows': [
        {
          'id': 'ABC',
          'cellValuesByColumnId': {
            '456': 'bar'
          }
        },
        {
          'id': 'DEF',
          'cellValuesByColumnId': {
            '123': 0
          }
        }
      ]
    })
  })

  it('passes the coordination test in the spec', () => {
    const server = new Server()
    const clientA = new Client(server)
    const clientB = new Client(server)

    // Add some data.
    clientA.createRow('ABC')
    clientA.createColumn('123', Type.Text)
    clientA.updateTextCellValue('ABC', '123', 'foo')

    // Clients go offline.
    clientA.goOffline()
    clientB.goOffline()

    // Both clients make some conflicting offline changes.
    clientA.updateTextCellValue('ABC', '123', 'bar')
    clientB.updateTextCellValue('ABC', '123', 'baz')

    // A and B should be out-of-sync at this point.
    expect(clientA.getData()).not.to.equal(clientB.getData())

    // B comes online before A.
    clientB.comeOnline()
    clientA.comeOnline()

    // Everything synced (conflict resolved by online order).
    expect(clientA.getData()).to.equal(server.getData())
    expect(clientB.getData()).to.equal(server.getData())
    expect(JSON.parse(clientA.getData())).to.deep.equal({
      'columns': [
        { 'id': '123', 'type': 'text' }
      ],
      'rows': [
        {
          'id': 'ABC',
          'cellValuesByColumnId': {
            '123': 'bar' // Not baz.
          }
        }
      ]
    })
  })

  it('can edit row ordering asynchronously', () => {
    const server = new Server()
    const clientA = new Client(server)
    const clientB = new Client(server)
    const clientC = new Client(server)

    // Create some rows.
    clientA.createRow('A') // 0
    clientB.createRow('B') // 1
    clientC.createRow('C') // 2
    clientA.createRow('D') // 3
    clientB.createRow('E') // 4
    clientC.createRow('F') // 5

    // Clients go offline.
    clientA.goOffline()
    clientB.goOffline()
    clientC.goOffline()

    // Clients edit ordering.
    clientA.destroyRow('A')
    clientA.createRow('G')
    clientB.moveRow('C', 5)
    clientC.moveRow('F', 3)

    // Clients come online.
    clientA.comeOnline()
    clientB.comeOnline()
    clientC.comeOnline()

    // Everything synced (conflicts resolved by online order).
    expect(clientA.getData()).to.equal(server.getData())
    expect(clientB.getData()).to.equal(server.getData())
    expect(clientC.getData()).to.equal(server.getData())
    expect(JSON.parse(clientA.getData())).to.deep.equal({
      'columns': [],
      'rows': [
        { 'id': 'B', 'cellValuesByColumnId': {} },
        { 'id': 'F', 'cellValuesByColumnId': {} },
        { 'id': 'D', 'cellValuesByColumnId': {} },
        { 'id': 'E', 'cellValuesByColumnId': {} },
        { 'id': 'C', 'cellValuesByColumnId': {} },
        { 'id': 'G', 'cellValuesByColumnId': {} }
      ]
    })
  })

  it('can edit column types asynchronously', () => {
    const server = new Server()
    const clientA = new Client(server)
    const clientB = new Client(server)
    const clientC = new Client(server)

    // Create row/columns.
    clientA.createRow('ABC')
    clientA.createRow('DEF')
    clientB.createColumn('123', Type.Text)
    clientC.createColumn('456', Type.Number)

    // Clients go offline.
    clientA.goOffline()
    clientB.goOffline()
    clientC.goOffline()

    // Clients edit cells and column types.
    clientA.updateColumnType('123', Type.Number)
    clientB.updateNumberCellValue('ABC', '123', 1)
    clientA.updateColumnType('456', Type.Text) // Overridden!
    clientB.updateTextCellValue('ABC', '123', 'foo') // Fails!
    clientB.updateTextCellValue('DEF', '123', 'bar') // Fails!
    clientC.updateColumnType('456', Type.Number)
    clientC.updateNumberCellValue('ABC', '456', 2)
    clientC.updateNumberCellValue('DEF', '456', 3)

    // Clients come online.
    clientA.comeOnline()
    clientB.comeOnline()
    clientC.comeOnline()

    // Everything synced (conflicts resolved by online order).
    expect(clientA.getData()).to.equal(server.getData())
    expect(clientB.getData()).to.equal(server.getData())
    expect(clientC.getData()).to.equal(server.getData())
    expect(JSON.parse(clientA.getData())).to.deep.equal({
      'columns': [
        { 'id': '123', 'type': 'number' },
        { 'id': '456', 'type': 'number' }
      ],
      'rows': [
        {
          'id': 'ABC',
          'cellValuesByColumnId': {
            '123': 1,
            '456': 2
          }
        },
        {
          'id': 'DEF',
          'cellValuesByColumnId': {
            '456': 3
          }
        }
      ]
    })
  })
})
