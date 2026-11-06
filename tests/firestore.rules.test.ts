import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'

const OWNER = 'owner-uid'
const OTHER = 'other-uid'
const SHARE = 'a'.repeat(32)
const OFF = 'b'.repeat(32)
const sections = (over: Record<string, boolean> = {}) => ({ collection: true, wantlist: false, journal: false, gear: false, places: false, stats: false, ...over })
let env: RulesTestEnvironment

beforeAll(async () => {
  const rules = readFileSync('firestore.rules', 'utf8').replace('REPLACE_WITH_OWNER_UID', OWNER)
  env = await initializeTestEnvironment({ projectId: 'demo-vinyl-archive', firestore: { rules, host: '127.0.0.1', port: 8080 } })
})
afterAll(async () => env?.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const now = new Date()
    await setDoc(doc(db, `users/${OWNER}/albums/a1`), { title: 'Private Album', purchasePrice: 30 })
    await setDoc(doc(db, `publicCollections/${SHARE}`), { enabled: true, displayName: 'Eric', sections: sections(), updatedAt: now })
    await setDoc(doc(db, `publicCollections/${SHARE}/albums/a1`), { title: 'Public Album', artistNames: ['X'], publishedAt: now })
    await setDoc(doc(db, `publicCollections/${SHARE}/wantlist/w1`), { albumTitle: 'Wanted', publishedAt: now })
    await setDoc(doc(db, `publicCollections/${SHARE}/gear/g1`), { name: 'Deck', category: 'turntable', publishedAt: now })
    await setDoc(doc(db, `publicCollections/${OFF}`), { enabled: false, displayName: 'Hidden', sections: sections({ wantlist: true }), updatedAt: now })
    await setDoc(doc(db, `publicCollections/${OFF}/albums/a1`), { title: 'Hidden Album', artistNames: ['X'], publishedAt: now })
    await setDoc(doc(db, `publicCollections/${OFF}/wantlist/w1`), { albumTitle: 'Hidden want', publishedAt: now })
    await setDoc(doc(db, 'publicSite/main'), { enabled: true, shareId: SHARE, updatedAt: now })
  })
})

const anon = () => env.unauthenticatedContext().firestore()
const owner = () => env.authenticatedContext(OWNER).firestore()
const other = () => env.authenticatedContext(OTHER).firestore()
const ts = serverTimestamp

describe('private data', () => {
  it('denies anonymous and non-owner access', async () => {
    await assertFails(getDoc(doc(anon(), `users/${OWNER}/albums/a1`)))
    await assertFails(getDocs(collection(anon(), `users/${OWNER}/albums`)))
    await assertFails(setDoc(doc(anon(), `users/${OWNER}/albums/a2`), { title: 'x' }))
    await assertFails(getDoc(doc(other(), `users/${OWNER}/albums/a1`)))
    await assertFails(setDoc(doc(other(), `users/${OTHER}/albums/a1`), { title: 'x' }))
  })
  it('lets the owner read and write only their own path', async () => {
    await assertSucceeds(getDoc(doc(owner(), `users/${OWNER}/albums/a1`)))
    await assertSucceeds(setDoc(doc(owner(), `users/${OWNER}/gear/g9`), { name: 'Amp' }))
    await assertFails(getDoc(doc(owner(), `users/${OTHER}/albums/a1`)))
  })
})

describe('public website pointer', () => {
  it('is readable by anyone, but never listable', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'publicSite/main')))
    await assertFails(getDocs(collection(anon(), 'publicSite')))
    await assertFails(getDoc(doc(anon(), 'publicSite/other')))
  })
  it('can only be written by the owner, in a valid shape', async () => {
    await assertFails(setDoc(doc(anon(), 'publicSite/main'), { enabled: true, shareId: SHARE, updatedAt: ts() }))
    await assertFails(setDoc(doc(other(), 'publicSite/main'), { enabled: true, shareId: SHARE, updatedAt: ts() }))
    await assertSucceeds(setDoc(doc(owner(), 'publicSite/main'), { enabled: true, shareId: SHARE, updatedAt: ts() }))
    await assertSucceeds(setDoc(doc(owner(), 'publicSite/main'), { enabled: false, shareId: '', updatedAt: ts() }))
  })
  it('never reveals a share ID unless the site is public', async () => {
    await assertFails(setDoc(doc(owner(), 'publicSite/main'), { enabled: false, shareId: SHARE, updatedAt: ts() }))
    await assertFails(setDoc(doc(owner(), 'publicSite/main'), { enabled: true, shareId: 'short', updatedAt: ts() }))
    await assertFails(setDoc(doc(owner(), 'publicSite/main'), { enabled: true, shareId: SHARE, ownerUid: OWNER, updatedAt: ts() }))
  })
})

describe('public collection and sections', () => {
  it('lets anyone read an enabled share and only the sections that are switched on', async () => {
    await assertSucceeds(getDoc(doc(anon(), `publicCollections/${SHARE}`)))
    await assertSucceeds(getDocs(collection(anon(), `publicCollections/${SHARE}/albums`)))
    await assertFails(getDocs(collection(anon(), `publicCollections/${SHARE}/wantlist`)))
    await assertFails(getDoc(doc(anon(), `publicCollections/${SHARE}/gear/g1`)))
  })
  it('opens a section as soon as the owner switches it on, and closes it again', async () => {
    await assertSucceeds(setDoc(doc(owner(), `publicCollections/${SHARE}`), { enabled: true, displayName: 'Eric', sections: sections({ wantlist: true }), updatedAt: ts() }))
    await assertSucceeds(getDocs(collection(anon(), `publicCollections/${SHARE}/wantlist`)))
    await assertSucceeds(setDoc(doc(owner(), `publicCollections/${SHARE}`), { enabled: true, displayName: 'Eric', sections: sections(), updatedAt: ts() }))
    await assertFails(getDocs(collection(anon(), `publicCollections/${SHARE}/wantlist`)))
  })
  it('blocks everything when the share is disabled, whatever its section switches say', async () => {
    await assertFails(getDoc(doc(anon(), `publicCollections/${OFF}`)))
    await assertFails(getDocs(collection(anon(), `publicCollections/${OFF}/albums`)))
    await assertFails(getDocs(collection(anon(), `publicCollections/${OFF}/wantlist`)))
  })
  it('blocks listing shares and every visitor write', async () => {
    await assertFails(getDocs(collection(anon(), 'publicCollections')))
    await assertFails(setDoc(doc(anon(), `publicCollections/${SHARE}/albums/a9`), { title: 't', artistNames: [], publishedAt: ts() }))
    await assertFails(deleteDoc(doc(anon(), `publicCollections/${SHARE}/albums/a1`)))
    await assertFails(setDoc(doc(other(), `publicCollections/${SHARE}`), { enabled: true, displayName: 'x', sections: sections(), updatedAt: ts() }))
  })
  it('requires a complete, boolean-only sections map on the share document', async () => {
    await assertFails(setDoc(doc(owner(), `publicCollections/${SHARE}`), { enabled: true, displayName: 'E', updatedAt: ts() }))
    await assertFails(setDoc(doc(owner(), `publicCollections/${SHARE}`), { enabled: true, displayName: 'E', sections: { collection: true }, updatedAt: ts() }))
    await assertFails(setDoc(doc(owner(), `publicCollections/${SHARE}`), { enabled: true, displayName: 'E', sections: { ...sections(), gear: 'yes' }, updatedAt: ts() }))
    await assertFails(setDoc(doc(owner(), `publicCollections/${SHARE}`), { enabled: true, displayName: 'E', sections: sections(), ownerUid: OWNER, updatedAt: ts() }))
  })
  it('lets the owner read a disabled share for preview', async () => { await assertSucceeds(getDoc(doc(owner(), `publicCollections/${OFF}`))) })
})

describe('what can be written to each public collection', () => {
  const at = (p: string) => doc(owner(), `publicCollections/${SHARE}/${p}`)
  it('accepts valid documents', async () => {
    await assertSucceeds(setDoc(at('albums/a2'), { title: 'T', artistNames: ['A'], rating: 8.5, discogs: { have: 3 }, purchases: [{ price: 5, currency: 'USD' }], publishedAt: ts() }))
    await assertSucceeds(setDoc(at('wantlist/w2'), { albumTitle: 'T', priority: 'high', targetPrice: 20, currency: 'USD', publishedAt: ts() }))
    await assertSucceeds(setDoc(at('listens/l1'), { albumTitle: 'T', date: '2026-03-01', completedAlbum: true, vibeTags: ['x'], publishedAt: ts() }))
    await assertSucceeds(setDoc(at('gear/g2'), { name: 'Amp', category: 'amplifier', purchasePrice: 200, currency: 'USD', publishedAt: ts() }))
    await assertSucceeds(setDoc(at('places/p1'), { name: 'Shop', latitude: 45.1, longitude: -93.4, publishedAt: ts() }))
  })
  it('rejects private fields', async () => {
    await assertFails(setDoc(at('albums/a2'), { title: 'T', artistNames: ['A'], purchasePrice: 20, seller: 's', publishedAt: ts() }))
    await assertFails(setDoc(at('wantlist/w2'), { albumTitle: 'T', notes: 'private', publishedAt: ts() }))
    await assertFails(setDoc(at('listens/l1'), { albumTitle: 'T', date: '2026-03-01', locationText: 'home', publishedAt: ts() }))
    await assertFails(setDoc(at('gear/g2'), { name: 'Amp', category: 'amplifier', seller: 'Shop', notes: 'n', publishedAt: ts() }))
    await assertFails(setDoc(at('places/p1'), { name: 'Shop', latitude: 1, longitude: 2, address: '1 Main St', publishedAt: ts() }))
  })
  it('rejects bad values', async () => {
    await assertFails(setDoc(at('albums/a2'), { title: 'T', artistNames: ['A'], rating: 11, publishedAt: ts() }))
    await assertFails(setDoc(at('albums/a2'), { title: 'T', artistNames: ['A'], artworkUrl: 'javascript:alert(1)', publishedAt: ts() }))
    await assertFails(setDoc(at('wantlist/w2'), { albumTitle: 'T', priority: 'urgent', publishedAt: ts() }))
    await assertFails(setDoc(at('gear/g2'), { name: 'Amp', category: 'amplifier', purchasePrice: -1, publishedAt: ts() }))
    await assertFails(setDoc(at('places/p1'), { name: 'Shop', latitude: 91, longitude: 2, publishedAt: ts() }))
    await assertFails(setDoc(at('places/p1'), { name: 'Shop', latitude: 1, longitude: 181, publishedAt: ts() }))
  })
  it('requires the server timestamp, so documents cannot be back-dated', async () => {
    await assertFails(setDoc(at('gear/g2'), { name: 'Amp', category: 'amplifier', publishedAt: new Date('2020-01-01') }))
  })
})
