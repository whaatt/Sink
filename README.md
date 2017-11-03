# Sink #

Sink is a proof-of-concept shared spreadsheets application.

## Setup ##

1. Clone this repository into some directory.
2. Download the newest versions of Node.JS and NPM.
3. Run `npm install` in the directory from Step One.
4. Run `npm run-script prepare` to build from source.
5. Run `npm test` to execute all available tests.

## Design ##

Sink is built around an authoritative server state, propagated to clients by
means of update messages. When each client connects or re-connects to the
server, they sync once with the entire table state object and then receive
ongoing updates to the authoritative state. These updates have incremental
version numbers and are applied to a local table instance per client.

### Sync ###

When local changes are made, however, they are not applied to the local table
instance until the server has acknowledged and merged the changes. This model
is problematic both when network latency is high as well as when the client is
offline (we can consider this generically as a case of infinite latency).

To overcome this issue, we preserve outgoing updates in an outbox until the
server has acknowledged their receipt. If we need to produce a materialized
view of the table, we use a fork of the local table instance that has the new
updates applied.

In turn, this creates an edge case. Consider a case where the current version
number is 123. As the client, we apply 4 different updates to table version
123 (which is in our local table instance), and in the intervening period, we
receive update 124. Now it becomes possible that our pending updates will not
be accepted by the server (due to an irreconcilable merge conflict). In this
edge case, we opt to always materialize the authoritative table.

* It is reasonable to ask if we could attempt resolution of the merge
conflicts locally (and wait on the server for an official answer). This is
something to implement later, and I have a strategy to do this, but it is not
currently implemented for the sake of simplicity. 

As a final high-level note, consider again the case where we apply several
updates to a local table state before receiving a server update. Some of these
updates might fail to merge, and if this is the case, we might want to stop
applying the remaining updates (if they are dependent). In my code, each
message can be marked with the same group ID to reflect a dependency. _By
default, currently, I only change the group ID when the local table state is
updated._

### Merging ###

We have discussed the high-level behavior around sync, including clients that
are online and offline. Next, we describe how updates are merged into the
authoritative server state in a consistent way.

The first principle is that updates are applied in the order they are received
from clients. If several clients are coming online at the same time, each with
pending updates to deliver, they will be applied in the order they arrive at
the server.

With this in mind, most updates are straightforward to merge. Creating rows
and columns succeeds if the desired IDs are not in use; destroying rows and
columns succeeds if the given IDs exist; and updating cells succeeds if the
row ID exists, the column ID exists, and the column type for the cell matches
the update that is being executed.

Updating column types is slightly trickier, but still straightforward. If the
cell values in the column that is being updated can all be coerced to the
desired type, we perform this coercion and accept the update. The decision
to coerce cells is somewhat arbitrary, but guided by my past experience with
spreadsheet software.

#### Shift Contexts ####

Perhaps the trickiest part of the whole module is handling asynchronous
movement of rows. As a motivating example, consider two clients that are
currently offline. If one client deletes a row, and the other client moves a
row, it is possible that the indices of the move will be affected if the
delete update is processed first.

For this reason, every message is published with the version number it is
modifying. On the server side, we keep track of the entire update history, and
if the next update to be processed was related to a historic table state (and
not the current one), and if the udpate relies on row indices, we need to
compute its _shift context_.

Shift contexts answer the following question: Given the indices in a certain
update, what do those indices correspond to in the present table state? We can
also ask the question of where those indices moved across several intervening
updates.

To compute a shift context, we simply iterate over the update history, between
the version number in the update being processed and the current version
number. For each intervening update, we store where it deleted and inserted
rows (note that we can model a move as a deletion and an insertion), if it did
so.

Then, to transform the indices in the update being processed, we increment
and decrement iteratively for each intervening update (based on whether the
intervening update could have affected the index in question). Once the update
is applied, we store its transformed indices in the update history.
