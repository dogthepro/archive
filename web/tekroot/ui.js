(function(){
  function workingShow() {
    document.getElementById('working').style.display='flex'
  }
  function workingHide() {
    document.getElementById('working').style.display='none'
  }
  
  function dlPayloadImage(target, cb) {
    window.fetch(target, {method:'GET'}).then(resp => {
      if(!resp.ok) {
        throw new Error(resp.statusText)
        cb(null)
        return
      }
      resp.arrayBuffer().then(buf => {
        cb(buf)
      })
    })
  }

  if(navigator.usb) {
    var TE = new TextEncoder, TD = new TextDecoder
    addEventListener('click', e=> {
      if(e.target.tagName.toLowerCase() === 'button') {
        if(e.target.id === 'connect') {
          workingShow()
          let mtkFastbooter = new USBIO()
          mtkFastbooter.connect().then(async function(dev) {
            await mtkFastbooter.sendData(TE.encode('FASTBOOT'))
            alert('Fastboot request sent, press Jailbreak when Fastboot is on')
            workingHide()
          }).catch(e => {
            console.error(e)
            workingHide()
          })
          mtkFastbooter.handleDisconnect(() => {
            workingHide()
          })
        }
        if(e.target.id === 'attempt-oem-unlock') {
          workingShow()
          let fastboot = new USBIO({classCode: 255, subclassCode: 66, protocolCode: 3})
          fastboot.connect().then(async function(dev) {
            await fastboot.sendData(TE.encode('oem unlock'))
            res = await fastboot.receiveData(4)
            alert('Unlock result:\n' + TD.decode(res))
            workingHide()
          }).catch(e => {
            console.error(e)
            workingHide()
          })
          fastboot.handleDisconnect(dev => {
            workingHide()
          })
        }
        if(e.target.id === 'normal-reboot') {
          workingShow()
          let fastboot = new USBIO({classCode: 255, subclassCode: 66, protocolCode: 3})
          fastboot.connect().then(async function(dev) {
            await fastboot.sendData(TE.encode('reboot'))
            workingHide()
          }).catch(e => {
            console.error(e)
            workingHide()
          })
          fastboot.handleDisconnect(dev => {
            workingHide()
          })
        }
        if(e.target.id === 'mtk-reboot-recovery') {
          workingShow()
          let fastboot = new USBIO({classCode: 255, subclassCode: 66, protocolCode: 3})
          fastboot.connect().then(async function(dev) {
            await fastboot.sendData(TE.encode('oem reboot-recovery'))
            workingHide()
          }).catch(e => {
            console.error(e)
            workingHide()
          })
          fastboot.handleDisconnect(dev => {
            workingHide()
          })
        }
        if(e.target.id === 'jailbreak') {
          workingShow()
          let fastboot = new USBIO({classCode: 255, subclassCode: 66, protocolCode: 3})
          fastboot.connect().then(dev => {
            dlPayloadImage('cache-jb.img', async function(buf) {
              let img = new Uint8Array(buf), imglen = img.length
              let imglenhex = ('00000000' + imglen.toString(16)).slice(-8)
              await fastboot.sendData(TE.encode('download:'+imglenhex))
              let str = ''
              do {
                str = await fastboot.receiveData(12)
              } while(TD.decode(str.data).indexOf('DATA'+imglenhex) === -1)
              await fastboot.sendData(buf)
              await fastboot.receiveData(4) //OKAY
              await fastboot.sendData(TE.encode('flash:cache'))
              await fastboot.receiveData(64) //OKAY
              await fastboot.sendData(TE.encode('reboot'))
              alert('Jailbreak sent')
              workingHide()
            })
          }).catch(e => {
            console.error(e)
            workingHide()
          })
          fastboot.handleDisconnect(dev => {
            workingHide()
          })
        }
        if(e.target.id === 'bootexp') {
          workingShow()
          let fastboot = new USBIO({classCode: 255, subclassCode: 66, protocolCode: 3})
          fastboot.connect().then(dev => {
            dlPayloadImage('rooted.img', async function(buf) {
              let img = new Uint8Array(buf), imglen = img.length
              let imglenhex = ('00000000' + imglen.toString(16)).slice(-8)
              await fastboot.sendData(TE.encode('download:'+imglenhex))
              let str = ''
              do {
                str = await fastboot.receiveData(12)
              } while(TD.decode(str.data).indexOf('DATA'+imglenhex) === -1)
              await fastboot.sendData(buf)
              await fastboot.receiveData(4) //OKAY
              await fastboot.sendData(TE.encode('boot'))
              await fastboot.receiveData(4) //OKAY
              await fastboot.sendData(TE.encode('continue'))
              alert('Bootsequence sent')
              workingHide()
            })
          }).catch(e => {
            console.error(e)
            workingHide()
          })
          fastboot.handleDisconnect(dev => {
            workingHide()
          })
        }
      }
    })
  } else {
    let connectBtn = document.getElementById('connect')
    connectBtn.setAttribute('disabled', 'disabled')
    connectBtn.innerHTML = 'Unsupported'
    connectBtn.classList.add('elem-warning')
    connectBtn.style.cursor = 'not-allowed'
    let jbBtn = document.getElementById('jailbreak')
    jbBtn.setAttribute('disabled', 'disabled')
    jbBtn.innerHTML = 'Unsupported'
    jbBtn.classList.add('elem-warning')
    jbBtn.style.cursor = 'not-allowed'
    alert('Sorry, your browser doesn\'t support WebUSB API. ca.in. cannot run without it.')
  }
})()
