//USB I/O class for WebUSB
//(c) Luxferre 2020-present

class USBIO {

  //Possible devFilter fields: classCode, subclassCode, protocolCode, vendorId, productId, serialNumber (not recommended)

  constructor(devFilter = {}) {
    this.requestDeviceObject = {filters:(devFilter ? [devFilter] : [])}
    this.devFilter = devFilter
    this.dev = null
    this.confNum = 0
    this.interfaceNum = 0
    this.alt = null
    this.inEndpointNum = 0
    this.outEndpointNum = 0
    this.packetSize = 0
    this.PID = 0
    this.VID = 0
  }

  async connect() {
    this.dev = await navigator.usb.requestDevice(this.requestDeviceObject)
    this.PID = this.dev.vendorId
    this.VID = this.dev.productId
    await this.dev.open()
    for(let conf of this.dev.configurations)
      for(let intf of conf.interfaces)
        for(let alt of intf.alternates)
          if(this.devFilter.protocolCode) { //look for a particular protocol
            if(this.devFilter.classCode == alt.interfaceClass &&
              this.devFilter.subclassCode == alt.interfaceSubclass &&
              this.devFilter.protocolCode == alt.interfaceProtocol) {
              this.confNum = conf.configurationValue
              this.interfaceNum = intf.interfaceNumber
              this.alt = alt
            }
          }
          else { //just look for a bulk transfer interface
            if(alt.interfaceClass === 10 && alt.endpoints.length === 2 && alt.endpoints.every(endp=>endp.type==='bulk')) {
              this.confNum = conf.configurationValue
              this.interfaceNum = intf.interfaceNumber
              this.alt = alt
            }
          }
    if(this.alt) {
        if(this.alt.endpoints[0].direction === 'in') {
          this.inEndpointNum = this.alt.endpoints[0].endpointNumber
          this.packetSize = this.alt.endpoints[0].packetSize
          this.outEndpointNum = this.alt.endpoints[1].endpointNumber
        } else {
          this.inEndpointNum = this.alt.endpoints[1].endpointNumber
          this.packetSize = this.alt.endpoints[1].packetSize
          this.outEndpointNum = this.alt.endpoints[0].endpointNumber
        }
    }
    await this.dev.selectConfiguration(this.confNum) 
    await this.dev.claimInterface(this.interfaceNum)
    await this.dev.selectAlternateInterface(this.interfaceNum, this.alt.alternateSetting)
    return this.dev
  }

  async disconnect() {
    await this.dev.clearHalt('in', this.inEndpointNum)
    await this.dev.clearHalt('out', this.outEndpointNum)
    await this.dev.close()
    this.dev = null
  }

  handleDisconnect(cb) {
    navigator.usb.addEventListener('disconnect', e => {
      if(e.device.productId === this.PID && e.device.vendorId === this.VID) {
        this.dev = null
        cb(e.device) 
      }
    })
  }

  async sendData(buf) {
    await this.dev.transferOut(this.outEndpointNum, buf)
  }

  async receiveData(len) {
    let data = await this.dev.transferIn(this.inEndpointNum, len)
    return data
  }
}
