function Buster() {
  var devRef = null, intNum, confNum, outEndpointNum, inEndpointNum, packetSize, 
      TD = new TextDecoder, TE = new TextEncoder, outBuf, VID, PID, contactNameLimits = [16, 12]

  async function devInit(dev) {
    outBuf = ""
    if(dev) {
      VID = dev.vendorId
      PID = dev.productId
      devRef = dev
    } else if(!devRef) return
    let readLoop = () => {
      if(devRef) devRef.transferIn(inEndpointNum, packetSize).then(result => {
        outBuf += TD.decode(result.data)
        readLoop()
      }, function(error) {
        if(devRef) devClose().then(() => {
          devInit()
        }).catch(err => {console.error(err)})
      })
    }
    scanInterfaces(devRef)
    await devRef.open()
    if(devRef.configuration === null)
      await devRef.selectConfiguration(confNum)
    await devRef.claimInterface(intNum)
    readLoop()
  }

  async function devClose() {
    await devRef.clearHalt("in", inEndpointNum)
    await devRef.clearHalt("out", outEndpointNum)
    await devRef.close()
  }

  function readOutput(expected, err, cb) {
    (function reader() {
      if(expected.test(outBuf) || err.test(outBuf)) {
        let snippet = outBuf.slice()
        outBuf = ""
        cb(snippet)
      }
      else setTimeout(reader, 300)
    })()
  }

  async function fireData(dataString) {
    let encodedString = TE.encode(dataString + "\x1a")
    await devRef.transferOut(outEndpointNum, encodedString)
  }

  async function fireCmd(cmdString) {
    cmdString = cmdString.trim()
    //console.log('firing', cmdString)
    let encodedCmd = TE.encode(cmdString + "\x0d\x0a")
    await devRef.transferOut(outEndpointNum, encodedCmd)
  }

  async function sendCmd(cmdString, expectedResponseRegex, errorResponseRegex, outCb, errorCb) {
    if(typeof expectedResponseRegex === 'string')
      expectedResponseRegex = RegExp(expectedResponseRegex, 'im')
    if(typeof errorResponseRegex === 'string')
      errorResponseRegex = RegExp(errorResponseRegex, 'im')
    await fireCmd(cmdString)
    readOutput(expectedResponseRegex, errorResponseRegex, out => {
      //console.log(out)
      if(errorResponseRegex.test(out) && errorCb) {
        errorCb(out)
      } else if(expectedResponseRegex.test(out)) {
        let bufferMatch = out.match(expectedResponseRegex)
        if(outCb)
          outCb(bufferMatch.length === 2 ? bufferMatch[1] : bufferMatch[0])
      } else if(errorCb) {
        errorCb(out)
      }
    })
  }

  function sendCmdBatch(cmdArray, expectedResponseRegex, errorResponseRegex, successCb, errorCb) {
    if(!cmdArray.length) successCb()
    else
      sendCmd(cmdArray.shift(), expectedResponseRegex, errorResponseRegex,  out => {
        sendCmdBatch(cmdArray, expectedResponseRegex, errorResponseRegex, successCb, errorCb)
      }, errorCb)
  }
  
  function scanInterfaces(dev) {
    //console.log(dev)
    if(dev.manufacturerName.indexOf('Nokia') > -1) {
      confNum = 1
      intNum = 1
      inEndpointNum = 2
      outEndpointNum = 2
      packetSize = 64
    }
    else for(let conf of dev.configurations) 
      for(let iface of conf.interfaces)
        for(let alt of iface.alternates)
          if(alt.interfaceClass === 10 && alt.endpoints.length === 2 && alt.endpoints.every(endp=>endp.type==='bulk')) {
            confNum = conf.configurationValue
            intNum = iface.interfaceNumber
            if(alt.endpoints[0].direction === 'in') {
              inEndpointNum = alt.endpoints[0].endpointNumber
              packetSize = alt.endpoints[0].packetSize
              outEndpointNum = alt.endpoints[1].endpointNumber
            } else {
              inEndpointNum = alt.endpoints[1].endpointNumber
              packetSize = alt.endpoints[1].packetSize
              outEndpointNum = alt.endpoints[0].endpointNumber
            }
            return
          }
  }

  function utf2pdu(str) {
    return str.split('').map(c=>('0000'+c.charCodeAt(0).toString(16)).slice(-4)).join('').toUpperCase()
  }
  
  function encodeSMSData(number, text, isFlash) {
    number = number.replace(/[^\d]+/g, '')
    let numlen = number.length 
    if(numlen & 1) {
      number += 'F'
    }
    let mangledNumber = number.match(/\d{2}/g).map(c=>c.split('').reverse().join('')).join('')
    let pdu = '003100' + ('0'+numlen.toString(16)).slice(-2) + '91' + mangledNumber  + '00'
    pdu += (isFlash ? '1' : '0') + '8FF'
    pdu += ('0'+(text.length<<1).toString(16)).slice(-2) + utf2pdu(text)
    return pdu.toUpperCase()
  }

  function generateContactWriteCmd(name, number) {
    let numType = 129
    if(number.indexOf('+')===0) {
      numType = 145
      number = number.slice(1)
    }
    return 'AT+CPBW=,"'+number+'",'+numType+',"'+utf2pdu(name)+'"'
  }
  
  return {
    connect: (success, error) => {
      navigator.usb.requestDevice({filters:[]})
        .then(dev => {
          devInit(dev).then(success)
        }).catch(error => {console.error(error); error()})  
    },
    handleDisconnect: cb => {
      navigator.usb.addEventListener('disconnect', e => {
        if(e.device.productId === PID && e.device.vendorId === VID) {
          devRef = null
          cb(e.device) 
        }
      })
    },
    disconnect: async function() {
      await devClose()
      devRef = null
    },
    sendRawCmd: sendCmd,
    fireRawCmd: fireCmd,
    prepareSession: (success, error) => {
      sendCmdBatch(['AT', 'AT', 'AT', 'AT+CMEE=2'], 'OK', 'ERROR', success, error)
    },
    readInfo: (success, error) => {
      sendCmd('AT+EGMR=0,3', /\+EGMR:\s+"(.+?)"/im, 'ERROR', function(fwinfo) {
        sendCmd('AT+EGMR=0,0', /\+EGMR:\s+"(.+?)"/im, 'ERROR', function(cpuinfo) {
          sendCmd('AT+EGMR=0,4', /\+EGMR:\s+"(.+?)"/im, 'ERROR', function(hwrev) {
            success({firmware: fwinfo, hardware: cpuinfo, hwrev: hwrev})
          }, error)
        }, error)
      }, error)
    }, 
    readImei: (simNumber, success, error) => {
      let simcode = [7,10,11,12][simNumber-1]
      sendCmd('AT+EGMR=0,'+simcode, /\+EGMR:\s+"(\d+?)"/im, 'ERROR', success, error)
    },
    writeImei: (simNumber, newImei, success, error) => {
      let simcode = [7,10,11,12][simNumber-1]
          sendCmd('AT+EGMR=1,'+simcode+',"'+newImei.trim().replace(/[^\d]+/g, '')+'"', '', 'ERROR', success, error) 
    },
    sendKeys: (seq, success, error) => {
      seq = seq.trim().toLowerCase().replace(/[^\d*#<>v^\[\]mes]/g, '')
      fireCmd('AT+CKPD="'+seq+'"').then(success).catch(error)
    },
    detectSimSupport: (success, error) => {
      sendCmd('AT+ESUO=?', /\+ESUO:\s+\((\d\-\d)\)/im, 'ERROR', val => {
        let vals = val.split('-').map(Number)
        success(vals[1]-3, vals[0] < 4)
      }, error)
    },
    selectOperationSim: (simNumber, success, error) => {
      sendCmd('AT+ESUO=' + (simNumber+3), 'OK', 'ERROR', success, error)
    },
    sendSMS: (number, text, isFlash, success, error) => {
      let PDU = encodeSMSData(number, text.slice(0, 70), isFlash), pduLen = (PDU.length >> 1) - 1;
      sendCmd('AT+CMGF=0', 'OK', 'ERROR', () => {
        sendCmd('AT+CMGS='+pduLen, '>', 'ERROR', () => {
          fireData(PDU).then(success).catch(error)
        }, error)
      }, error)
    },
    importContacts: (googleCsv, useSIM, success, error) => {
      if(googleCsv) Papa.parse(googleCsv, {
        complete: res=>{
          let contacts = res.data.slice(1),
              cmds = ['AT+CPBS="' + (useSIM ? 'SM' : 'ME') + '"', 'AT+CSCS="UCS2"'],
              nameLimit = contactNameLimits[useSIM|0]
          for(let entry of contacts) {
            if(entry.length === 37) {
              let name = entry[0].trim().slice(0, nameLimit),
                  splt = entry[32].split(':::')
                  phone1 = splt[0].replace(/[^\d\+wp]/g, '').trim(),
                  phone1Additional = splt[1] ? splt[1].replace(/[^\d\+wp]/g, '').trim() : null,
                  phone2 = entry[34].replace(/[^\d\+wp]/g, '')
              //console.log(name, name.length)
              if(phone1) cmds.push(generateContactWriteCmd(name, phone1))
              if(phone1Additional) cmds.push(generateContactWriteCmd(name.slice(0, nameLimit - 2) + ' 1', phone1Additional))
              if(phone2) cmds.push(generateContactWriteCmd(name.slice(0, nameLimit - 2) + ' 2', phone2))
            }
          }
          sendCmdBatch(cmds, 'OK', 'ERROR', success, error)
        }
      })
      else error()
    }
  }
}
