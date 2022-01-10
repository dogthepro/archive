(function(){
  function workingShow() {
    document.getElementById('working').style.display='flex'
  }
  function workingHide() {
    document.getElementById('working').style.display='none'
  }
  if(navigator.usb) {
    var buster = Buster(),
        imeiTextElement = document.getElementById('imeival'),
        simSelectElement = document.getElementById('simselect')
    function readImei() {
      workingShow()
      buster.readImei(simSelectElement.value|0, (res)=>{imeiTextElement.value=res; workingHide()}, (err)=>{alert('Error reading IMEI for current SIM');workingHide()})
    }
    function readInfo() {
      workingShow()
      buster.readInfo((info)=>{
        let outString = "Firmware: "+info.firmware+"\nChipset: "+info.hardware+"\nHardware revision: "+info.hwrev
        document.getElementById('infofield').innerHTML = outString
        readImei()
      }, (err)=>{alert('Error reading device information');workingHide()})
    }
    addEventListener('click', (e)=>{
      if(e.target.tagName.toLowerCase() === 'button') {
        if(e.target.id === 'connect') {
          workingShow()
          buster.connect(()=>{
            var toolbox = document.querySelector('.toolbox')
            buster.prepareSession(()=>{
              buster.detectSimSupport((simCount, dtEnabled)=>{
                let opts = toolbox.querySelectorAll('#simselect option'), l = opts.length
                for(i=0;i<l;i++)
                  if(i>=simCount) opts[i].disabled = true
                toolbox.style.display='flex'
                readInfo()
              }, workingHide)
            }, workingHide)
            buster.handleDisconnect(dev=>{
              toolbox.style.display='none'
              workingHide()
            })
          }, workingHide) 
        }
        else if(e.target.id === 'getinfo') readInfo()
        else if(e.target.id === 'rdimei') readImei()
        else if(e.target.id === 'wrimei') {
          workingShow()
          buster.writeImei(simSelectElement.value|0, imeiTextElement.value, (res)=>{alert('IMEI changed for current SIM, reboot your device');workingHide()}, (err)=>{alert('Error changing IMEI for the selected SIM');workingHide()})
        }
        else if(e.target.id === 'kpdsend') buster.sendKeys(document.getElementById('kpdval').value, (res)=>{alert('Key sequence sent')}, (err)=>{alert('Error sending key sequence')})
        else if(e.target.id === 'smssend' && document.getElementById('smsnum').value) {
          workingShow()
          buster.sendSMS(document.getElementById('smsnum').value.trim(), document.getElementById('smstext').value.trim(), !!Number(document.getElementById('smsopt').value), ()=>{alert('SMS sent successfully'); workingHide()}, (err)=>{alert('Failed sending SMS'); workingHide()}) 
        }
        else if(e.target.id === 'ctimport' && document.getElementById('importfile').files.length) {
          workingShow()
          buster.importContacts(document.getElementById('importfile').files[0], !!parseInt(document.getElementById('contactdest').value), ()=>{
            alert('Contacts successfully imported')
            workingHide()
          }, ()=>{alert('Error importing contacts'); workingHide()})
        }
      }
    })
    addEventListener('change', (e)=>{
      if(e.target.id === 'simselect') {
        workingShow()
        buster.selectOperationSim(simSelectElement.value|0,workingHide(),(err)=>{alert('Unable to change current operation SIM!');workingHide()})
      }
      else if(e.target.id === 'importfile') {
        let fileSel = document.getElementById('importfile')
        if(fileSel.files.length)
          document.getElementById('importlabel').innerHTML = fileSel.files[0].name
      }
    })
  } else {
    let connectBtn = document.getElementById('connect')
    connectBtn.setAttribute('disabled', 'disabled')
    connectBtn.innerHTML = 'Unsupported'
    connectBtn.classList.add('elem-warning')
    connectBtn.style.cursor = 'not-allowed'
    alert('Sorry, your browser doesn\'t support WebUSB API. TekBuster cannot run without it.')
  }
})()
