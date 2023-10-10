import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {   ConnectionQuality,
  ConnectionState,
  DataPacket_Kind,
  DisconnectReason,
  ExternalE2EEKeyProvider,
  LocalAudioTrack,
  LocalParticipant,
  LogLevel,
  MediaDeviceFailure,
  Participant,
  ParticipantEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Room,
  RoomConnectOptions,
  RoomEvent,
  RoomOptions,
  Track,
  TrackPublication,
  VideoCaptureOptions,
  VideoCodec,
  VideoPresets,
  VideoQuality,
  createAudioAnalyser,
  setLogLevel,
  supportsAV1,
  supportsVP9, } from 'livekit-client';


declare global {
  interface Window {
    _dx: any;
  }
}
@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit {
  $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  currentUserId:string | undefined;
  roomId: string | undefined;
  serverHttp:string | undefined;
  wssToken:string | undefined;
  wssServerAddress:string;
  startTime:number | undefined;
  currentRoom:Room | undefined;
  remoteIsShow:boolean = false;
  isMuted:boolean = false;//是否静音
  
   elementMapping: { [k: string]: MediaDeviceKind } = {
    // 'video-input': 'videoinput',
    'audio-input': 'audioinput',
    // 'audio-output': 'audiooutput',
  };
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  constructor(private route: ActivatedRoute,private http: HttpClient) {
    this.serverHttp = "http://localhost:8888";
    this.wssServerAddress = "wss://livekit.taoqiu.top";
    this.route.params.subscribe(x => {
      this.roomId = x['roomId'];
    });
    var that = this;
    this.initUnionUserId().then(function(token:string) {
      // that.currentUserId = token;

      that.currentUserId = that.generateUUID();
      that.initRoomToken();
      
    });

  }

  ngOnInit() {
   
  }
  newDisconnectResetData(){

  }
   state = {
    isFrontFacing: false,
    encoder: new TextEncoder(),
    decoder: new TextDecoder(),
    defaultDevices: new Map<MediaDeviceKind, string>(),
    bitrateInterval: undefined as any,
    e2eeKeyProvider: new ExternalE2EEKeyProvider(),
  };
  pushData(data:string){
    const msg = this.state.encoder.encode(data);
    this.currentRoom!.localParticipant.publishData(msg, DataPacket_Kind.RELIABLE);
  }

	renderParticipant(participant: Participant, remove: boolean = false) {
    var audioELm;
    if(participant.identity==this.currentUserId){
      return;
    }else{
      audioELm = <HTMLAudioElement>this.$(`audio-remote`);
    }

    if(remove){
      this.remoteIsShow = false;
    }else{
      this.remoteIsShow = true;
    }
    const micPub = participant.getTrack(Track.Source.Microphone);
    micPub?.audioTrack?.attach(audioELm!);
  }
  
  
getRoomCount(roomName:string): Observable<any> {
    const url = this.serverHttp+"/FindRoomCount/"+roomName; // 替换为你的API URL
    return this.http.get(url);
}

getRoomToken(roomName:string,userId:string): Observable<any> {
  const url = this.serverHttp+"/Token/"+roomName+"/"+userId; // 替换为你的API URL
  return this.http.get(url);
}

 appendLog(...args: any[]) {
  console.log(args);
}

async handleDevicesChanged() {
  Promise.all(
    Object.keys(this.elementMapping).map(async (id) => {
      const kind = this.elementMapping[id];
      if (!kind) {
        return;
      }
      const devices = await Room.getLocalDevices(kind);
    }),
  );
}
participantConnected(participant: Participant) {
  console.log('participant', participant.identity, 'connected', participant.metadata);
  console.log('tracks', participant.tracks);
  var that = this;
  participant
    .on(ParticipantEvent.TrackMuted, (pub: TrackPublication) => {
      console.log('track was muted', pub.trackSid, participant.identity);
      that.renderParticipant(participant);
    })
    .on(ParticipantEvent.TrackUnmuted, (pub: TrackPublication) => {
      console.log('track was unmuted', pub.trackSid, participant.identity);
      that.renderParticipant(participant);
    })
    .on(ParticipantEvent.IsSpeakingChanged, () => {
      that.renderParticipant(participant);
    })
    .on(ParticipantEvent.ConnectionQualityChanged, () => {
      that.renderParticipant(participant);
    });
}
participantDisconnected(participant: RemoteParticipant) {
  console.log('participant', participant.sid, 'disconnected');

  this.renderParticipant(participant, true);
}


 handleRoomDisconnect(reason?: DisconnectReason) {
  if (!this.currentRoom) return;
  console.log('disconnected from room', { reason });
  this.renderParticipant(this.currentRoom.localParticipant, true);
  this.currentRoom.participants.forEach((p) => {
    this.renderParticipant(p, true);
  });

  const container = this.$('participants-area');
  if (container) {
    container.innerHTML = '';
  }

  // clear the chat area on disconnect
  const chat = <HTMLTextAreaElement>this.$('chat');
  chat.value = '';

  this.currentRoom = undefined;
}

async mutedAudio(){
  var val = this.currentRoom!.localParticipant.isMicrophoneEnabled;
  await this.currentRoom!.localParticipant.setMicrophoneEnabled(!val);

  if(val){
    this.isMuted = true;
  }else{
    this.isMuted = false;
  }

}


async handleData(msg: Uint8Array, participant?: RemoteParticipant) {
  debugger;
  const str = this.state.decoder.decode(msg);
  
  console.log(str);
}

async ConnectRoom(){
  const roomOpts: RoomOptions = {
    adaptiveStream:true,
    dynacast:true,
    publishDefaults: {
      simulcast:true,
      videoSimulcastLayers: [VideoPresets.h90, VideoPresets.h216],
      videoCodec: 'vp8',
      dtx: true,
      red: true,
      forceStereo: false,
    },
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
  };

  const connectOpts: RoomConnectOptions = {
    autoSubscribe: true,
  };

  var shouldPublish = true;


  const room = new Room(roomOpts);
  this.startTime = Date.now();
  await room.prepareConnection(this.wssServerAddress, this.wssToken);
  const prewarmTime = Date.now() - this.startTime;
  console.log(`prewarmed connection in ${prewarmTime}ms`);

  var that = this;
  room
    .on(RoomEvent.ParticipantConnected, (participant: Participant)=> {
      console.log('participant', participant.identity, 'connected', participant.metadata);
      console.log('tracks', participant.tracks);
      participant
        .on(ParticipantEvent.TrackMuted, (pub: TrackPublication) => {
          console.log('track was muted', pub.trackSid, participant.identity);
          that.renderParticipant(participant);
        })
        .on(ParticipantEvent.TrackUnmuted, (pub: TrackPublication) => {
          console.log('track was unmuted', pub.trackSid, participant.identity);
          that.renderParticipant(participant);
        })
        .on(ParticipantEvent.IsSpeakingChanged, () => {
          that.renderParticipant(participant);
        })
        .on(ParticipantEvent.ConnectionQualityChanged, () => {
          that.renderParticipant(participant);
        });
    })
    .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant)=> {
      console.log('participant', participant.sid, 'disconnected');
    
      that.renderParticipant(participant, true);
    })
    .on(RoomEvent.DataReceived, (msg: Uint8Array, participant?: RemoteParticipant) =>{
      const str = that.state.decoder.decode(msg);
      
      console.log(str);
    })
    .on(RoomEvent.Disconnected, this.handleRoomDisconnect)
    .on(RoomEvent.Reconnecting, () => console.log('Reconnecting to room'))
    .on(RoomEvent.Reconnected, async () => {
      console.log(
        'Successfully reconnected. server',
        await room.engine.getConnectedServerAddress(),
      );
    })
    .on(RoomEvent.LocalTrackPublished, (pub) => {
      const track = pub.track as LocalAudioTrack;

      if (track instanceof LocalAudioTrack) {
        const { calculateVolume } = createAudioAnalyser(track);

        // setInterval(() => {
        //   $('local-volume')?.setAttribute('value', calculateVolume().toFixed(4));
        // }, 200);
      }
      this.renderParticipant(room.localParticipant);
    })
    .on(RoomEvent.LocalTrackUnpublished, () => {
      this.renderParticipant(room.localParticipant);
   
    })
    .on(RoomEvent.RoomMetadataChanged, (metadata) => {
      console.log('new metadata for room', metadata);
    })
    .on(RoomEvent.MediaDevicesChanged, this.handleDevicesChanged)
    .on(RoomEvent.AudioPlaybackStatusChanged, () => {
      // if (room.canPlaybackAudio) {
      //   $('start-audio-button')?.setAttribute('disabled', 'true');
      // } else {
      //   $('start-audio-button')?.removeAttribute('disabled');
      // }
    })
    .on(RoomEvent.MediaDevicesError, (e: Error) => {
      const failure = MediaDeviceFailure.getFailure(e);
      console.log('media device failure', failure);
    })
    .on(
      RoomEvent.ConnectionQualityChanged,
      (quality: ConnectionQuality, participant?: Participant) => {
        console.log('connection quality changed', participant?.identity, quality);
      },
    )
    .on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      console.log('subscribed to track', pub.trackSid, participant.identity);
      this.renderParticipant(participant);
    })
    .on(RoomEvent.TrackUnsubscribed, (_, pub, participant) => {
      console.log('unsubscribed from track', pub.trackSid);
      this.renderParticipant(participant);
    })
    .on(RoomEvent.SignalConnected, async () => {

      const signalConnectionTime = Date.now() - this.startTime!;
      console.log(`signal connection established in ${signalConnectionTime}ms`);
      // speed up publishing by starting to publish before it's fully connected
      // publishing is accepted as soon as signal connection has established
      if (shouldPublish) {
        // await room.localParticipant.enableCameraAndMicrophone();
        await room.localParticipant.setMicrophoneEnabled(true);
        console.log(`tracks published in ${Date.now() - this.startTime!}ms`);
        // updateButtonsForPublishState();
      }
    })
    .on(RoomEvent.ParticipantEncryptionStatusChanged, () => {
      // updateButtonsForPublishState();
    })
    .on(RoomEvent.TrackStreamStateChanged, (pub, streamState, participant) => {
      console.log(
        `stream state changed for ${pub.trackSid} (${
          participant.identity
        }) to ${streamState.toString()}`,
      );
    });

  try {
    // read and set current key from input
    await room.connect(this.wssServerAddress, this.wssToken!, connectOpts);

   

    const elapsed = Date.now() - this.startTime;
    console.log(
      `successfully connected to ${room.name} in ${Math.round(elapsed)}ms`,
      await room.engine.getConnectedServerAddress(),
    );
  } catch (error: any) {
    debugger;
    let message: any = error;
    if (error.message) {
      message = error.message;
    }
    console.log('could not connect:', message);
    return;
  }
  this.currentRoom = room;

  room.participants.forEach((participant) => {
    this.participantConnected(participant);
  });
  this.participantConnected(room.localParticipant);

  return room;
}


initUnionUserId(){
  var options = {
    appId: 'c66572f0becc7cffc0723b665c32302b', // 唯一标识，必填
  };
 return window._dx.ConstID(options);
}

  initRoomToken(){
    this.getRoomCount(this.roomId!).subscribe(x=>{
      var count = x.data;

      if(count<2){
        this.getRoomToken(this.roomId!,this.currentUserId!).subscribe(async x=>{

          this.wssToken = x.data;
console.log(this.wssToken);
          await this.ConnectRoom();
        });
      }else{
      alert("房间人数已满");
      return;
      }
    });
  }



  ngAfterViewInit(): void {
    // this.remoteIsJoin = true;
    
  }

}
