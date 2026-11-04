import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { rifUtente, salvaProfiloUtente } from '../../src/lib/classi'
import { avviaAmbiente, dbDi, UTENTI } from './aiuti'

const { anna, bruno } = UTENTI
let env: RulesTestEnvironment
beforeAll(async () => {
  env = await avviaAmbiente()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
})

it('ognuno registra i propri dispositivi per le notifiche, non quelli degli altri', async () => {
  await salvaProfiloUtente(dbDi(env, anna), anna)
  await assertSucceeds(updateDoc(rifUtente(dbDi(env, anna), 'anna'), { fcmTokens: arrayUnion('t1'), 'impostazioni.notifichePush': true }))
  expect((await getDoc(rifUtente(dbDi(env, anna), 'anna'))).data()?.fcmTokens).toEqual(['t1'])
  await assertFails(updateDoc(rifUtente(dbDi(env, bruno), 'anna'), { fcmTokens: arrayUnion('t2') }))
  await assertFails(updateDoc(rifUtente(dbDi(env, anna), 'anna'), { fcmTokens: 'non una lista' }))
  await assertFails(updateDoc(rifUtente(dbDi(env, anna), 'anna'), { fcmTokens: Array.from({ length: 21 }, (_, i) => `t${i}`) }))
})

it('le notifiche già mandate (invii) le vede e scrive solo il server', async () => {
  await assertFails(getDoc(doc(dbDi(env, anna), 'invii', 'x')))
  await assertFails(setDoc(doc(dbDi(env, anna), 'invii', 'x'), { uid: 'anna' }))
})
