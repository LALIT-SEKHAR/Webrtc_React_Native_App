import React, {useEffect, useRef, useState} from 'react';
import {
  Button,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  Touchable,
  TouchableOpacity,
  View,
} from 'react-native';
import {io} from 'socket.io-client';
import {
  mediaDevices,
  RTCView,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import {
  SERVER_ENDPOINT,
  STUN_URL,
  STUN_URL_PASSWORD,
  STUN_USERNAME,
} from './config';

const App = () => {
  const [stream, setStream] = useState(null);
  const [ClientStream, setClientStream] = useState(null);
  const Socket = useRef();
  const myPeer = useRef();
  const myMediaStream = useRef();

  useEffect(() => {
    start();
    Socket.current = io(SERVER_ENDPOINT);
    Socket.current.on('offer', payload => {
      let offer = null;
      if (!offer) {
        offer = payload;
        handelClientOffer(payload);
      }
    });
    Socket.current.on('ice_candidate', payload => {
      handelClientIceCandidate(payload);
    });
    Socket.current.on('answer', payload => {
      handelClientAnswer(payload);
    });
    Socket.current.on('close', payload => {
      myPeer.current && myPeer.current.close();
      myPeer.current && (myPeer.current = null);
      setClientStream(null);
    });
  }, []);

  const start = async () => {
    if (!stream) {
      let s;
      const isFront = true;
      try {
        s = await mediaDevices.getUserMedia({
          video: {facingMode: isFront ? 'user' : 'environment'},
        });
        myMediaStream.current = s;
        setStream(s);
      } catch (e) {
        console.error(e);
      }
    }
  };
  const stop = () => {
    if (stream) {
      stream.release();
      setStream(null);
    }
  };

  const handelClientOffer = offer => {
    myPeer.current = createPeer();
    addMediaTracks(myPeer.current);
    myPeer.current.onicecandidate = e => {
      Socket.current.emit('ice_candidate', JSON.stringify(e.candidate));
    };
    myPeer.current.onaddstream = e => {
      setClientStream(e.stream);
    };
    myPeer.current.setRemoteDescription(JSON.parse(offer)).then(e => {});
    myPeer.current
      .createAnswer()
      .then(answer => myPeer.current.setLocalDescription(answer))
      .then(e => {
        Socket.current.emit(
          'answer',
          JSON.stringify(myPeer.current.localDescription),
        );
      })
      .catch(error =>
        console.error({message: 'WebRTC localDescription error', error}),
      );
  };

  const createPeer = () => {
    return new RTCPeerConnection({
      iceServers: [
        {urls: 'stun:stun.stunprotocol.org'},
        {
          urls: STUN_URL,
          credential: STUN_URL_PASSWORD,
          username: STUN_USERNAME,
        },
      ],
    });
  };

  const handelClientIceCandidate = Ice_candidate => {
    if (JSON.parse(Ice_candidate).candidate) {
      myPeer.current
        .addIceCandidate(new RTCIceCandidate(JSON.parse(Ice_candidate)))
        .then()
        .catch(error => console.log('ERROR Ice_candidate: ', error.message));
    }
  };

  const addMediaTracks = async peer => {
    peer.addStream(myMediaStream.current);
  };

  const createOffer = peer => {
    peer
      .createOffer()
      .then(desc => {
        peer.setLocalDescription(desc).then(() => {
          Socket.current.emit('offer', JSON.stringify(peer.localDescription));
        });
      })
      .catch(error => console.log(error));
  };

  const callPeer = () => {
    myPeer.current = createPeer();
    addMediaTracks(myPeer.current);
    myPeer.current.onicecandidate = e => {
      Socket.current.emit('ice_candidate', JSON.stringify(e.candidate));
    };
    myPeer.current.onaddstream = e => {
      setClientStream(e.stream);
    };
    createOffer(myPeer.current);
  };

  const handelClientAnswer = answer => {
    myPeer.current.setRemoteDescription(JSON.parse(answer)).then(e => {});
  };

  const callEnd = () => {
    Socket.current.emit('close');
  };

  return (
    <View style={styles.container}>
      {stream && (
        <View style={styles.MyVideoWarper}>
          <RTCView
            mirror
            streamURL={stream.toURL()}
            style={styles.myVideo}
            objectFit="cover"
          />
        </View>
      )}
      {ClientStream ? (
        <RTCView
          streamURL={ClientStream.toURL()}
          style={styles.clientVideo}
          objectFit="contain"
        />
      ) : (
        <Text style={styles.whiteText}>No one is hear</Text>
      )}
      <View style={styles.btnWarper}>
        <TouchableOpacity style={styles.btn} onPress={callPeer}>
          <Text>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.Endbtn} onPress={callEnd}>
          <Text>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  MyVideoWarper: {
    width: Dimensions.get('window').width / 3,
    height: Dimensions.get('window').height / 4,
    position: 'absolute',
    bottom: 50,
    right: 0,
    zIndex: 11,
    margin: 10,
    overflow: 'hidden',
  },
  myVideo: {
    width: '100%',
    height: '100%',
  },
  clientVideo: {
    width: '100%',
    height: '100%',
  },
  btnWarper: {
    flexDirection: 'row',
    height: 50,
    position: 'absolute',
    bottom: 0,
  },
  btn: {
    width: '50%',
    backgroundColor: 'green',
    alignItems: 'center',
    justifyContent: 'center',
  },
  Endbtn: {
    width: '50%',
    backgroundColor: 'red',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteText: {
    color: 'white',
  },
});
