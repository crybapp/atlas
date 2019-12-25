import handleUndeliverableMessage from '../handlers/undeliverable'

import WSEvent, { WSEventType } from './event'
import { WSInternalEvent } from '../handlers/internal'

import client, { createPubSubClient } from '../../../config/redis.config'

const pub = createPubSubClient()

export default class WSMessage {
    opcode: number
    data: any
    type?: WSEventType
    
    constructor(opcode: number, data: any = {}, type?: WSEventType) {
        this.opcode = opcode
        this.data = data
        this.type = type
    }

    broadcast = async (recipients: string[] = ['*'], excluding: string[] = [], sync: boolean = true) => {
        recipients = recipients.filter(id => excluding.indexOf(id) === -1)
        if(recipients.length === 0) return
        
        const message = this.serialize(),
                internalMessage: WSInternalEvent = { message, recipients, sync }
        
        pub.publish('ws', JSON.stringify(internalMessage))

        if(recipients.length > 0) {
            try {
                const online = await client.smembers('connected_clients')
                if(!online) return
    
                const undelivered = recipients.filter(id => online.indexOf(id) === -1)
                handleUndeliverableMessage(message, undelivered)
            } catch(error) {
                console.error(error)
            }
        }
    }

    serialize = () => {
        let object: WSEvent = { op: this.opcode, d: this.data }
        if(this.type) object.t = this.type

        return object
    }
}
