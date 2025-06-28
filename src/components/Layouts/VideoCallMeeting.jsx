import React, { useEffect, useRef, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const VideoCallMeeting = ({ socket, userId }) => {
  const [meetingId, setMeetingId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [remotePermissions, setRemotePermissions] = useState({ audio: true, video: true });
  const [fullscreenVideo, setFullscreenVideo] = useState(null);
  const [mediaStatus, setMediaStatus] = useState({ video: true, audio: true });
  const [errorMessages, setErrorMessages] = useState([]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localStreamRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  const addError = (message) => {
    setErrorMessages(prev => [...prev, message]);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessages(prev => prev.slice(1));
    }, 5000);
  };

  const getUserMediaWithTimeout = async (constraints, timeout = 30000, retries = 2) => {
    let attempt = 0;
    while (attempt <= retries) {
      try {
        const stream = await Promise.race([
          navigator.mediaDevices.getUserMedia(constraints),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting media devices')), timeout))
        ]);
        return stream;
      } catch (err) {
        if (attempt < retries) {
          attempt++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw err;
        }
      }
    }
  };

  const checkDeviceAvailability = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(d => d.kind === 'videoinput');
      const hasMic = devices.some(d => d.kind === 'audioinput');

      const attemptMedia = async (constraints, type) => {
        try {
          const stream = await getUserMediaWithTimeout(constraints);
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch {
          return false;
        }
      };

      const videoAvailable = hasCamera ? await attemptMedia({ video: true }, 'video') : false;
      const audioAvailable = hasMic ? await attemptMedia({ audio: true }, 'audio') : false;

      setMediaStatus({ video: videoAvailable, audio: audioAvailable });
      return { videoAvailable, audioAvailable };
    } catch (err) {
      addError('Device check failed: ' + err.message);
      return { videoAvailable: false, audioAvailable: false };
    }
  };

  const createMeeting = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No auth token found');
      
      const res = await fetch(`${BACKEND_URL}/api/meetings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: 'Video Call Meeting' }),
      });
      
      if (!res.ok) throw new Error('Failed to create meeting');
      const data = await res.json();
      setMeetingId(data.meetingId);
    } catch (err) {
      addError(err.message);
    }
  };

  useEffect(() => {
    if (meetingId && socket && socket.connected) {
      socket.emit('joinMeeting', { meetingId, userId });
      setSocketConnected(true);
    }
  }, [meetingId, socket, userId]);

  useEffect(() => {
    if (!meetingId || !socket) return;

    const handleConnect = () => {
      socket.emit('joinMeeting', { meetingId, userId });
      setSocketConnected(true);
    };

    const handleOffer = async ({ offer, from }) => {
      try {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(offer);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('answer', { meetingId, answer, to: from });
      } catch (e) {
        addError('Failed to handle offer: ' + e.message);
      }
    };

    const handleAnswer = async ({ answer }) => {
      try {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(answer);
      } catch (e) {
        addError('Failed to handle answer: ' + e.message);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        if (!pcRef.current) return;
        await pcRef.current.addIceCandidate(candidate);
      } catch (e) {
        addError('Failed to add ICE candidate: ' + e.message);
      }
    };

    const handleMeetingEnded = () => {
      addError('Meeting has ended by host');
      cleanupMedia();
      setMeetingId(null);
      setSocketConnected(false);
      setFullscreenVideo(null);
    };

    const handleRemotePermissionUpdate = ({ audio, video }) => {
      setRemotePermissions({ audio, video });
    };

    socket.on('connect', handleConnect);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('meetingEnded', handleMeetingEnded);
    socket.on('remotePermissionUpdate', handleRemotePermissionUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('meetingEnded', handleMeetingEnded);
      socket.off('remotePermissionUpdate', handleRemotePermissionUpdate);
      socket.emit('leaveMeeting', { meetingId, userId });
      setSocketConnected(false);
    };
  }, [meetingId, socket, userId]);

  const cleanupMedia = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    originalVideoTrackRef.current = null;
    setIsScreenSharing(false);
  };

  useEffect(() => {
    if (!socketConnected || !meetingId) return;

    let isMounted = true;

    const startWebRTC = async () => {
      try {
        const { videoAvailable, audioAvailable } = await checkDeviceAvailability();
        
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        let localStream;
        try {
          localStream = await getUserMediaWithTimeout({
            video: videoAvailable ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
            audio: audioAvailable
          });
        } catch (err) {
          addError('Could not access media devices: ' + err.message);
          if (!isMounted) return;
        }

        if (!isMounted) return;

        if (localStream) {
          localStreamRef.current = localStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(e => {
              addError('Could not play local video: ' + e.message);
            });
          }

          localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
          });
        }

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && isMounted) {
            remoteVideoRef.current.srcObject = event.streams[0];
            remoteVideoRef.current.play().catch(e => {
              addError('Could not play remote video: ' + e.message);
            });
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && isMounted) {
            socket.emit('ice-candidate', { meetingId, candidate: event.candidate });
          }
        };

        socket.emit('checkIfCreator', { meetingId, userId }, async (isCreator) => {
          if (!isMounted || !pcRef.current) return;
          if (isCreator) {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit('offer', { meetingId, offer, to: null });
            } catch (e) {
              addError('Offer creation error: ' + e.message);
            }
          }
        });
      } catch (err) {
        addError('WebRTC setup failed: ' + err.message);
      }
    };

    startWebRTC();

    return () => {
      isMounted = false;
      cleanupMedia();
    };
  }, [socketConnected, meetingId, socket, userId]);

  const endMeeting = () => {
    if (!meetingId) return;
    socket.emit('endMeeting', { meetingId });
    cleanupMedia();
    setMeetingId(null);
    setSocketConnected(false);
    setFullscreenVideo(null);
  };

  const startScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }

    try {
      // Store the original video track
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          originalVideoTrackRef.current = videoTrack;
        }
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true,
        audio: mediaStatus.audio
      });
      
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Create a new stream combining screen video and original audio (if available)
      const combinedStream = new MediaStream();
      combinedStream.addTrack(screenTrack);
      
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          combinedStream.addTrack(audioTrack);
        }
      }

      // Update local video display
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = combinedStream;
        localVideoRef.current.play().catch(e => {
          addError('Could not play screen share: ' + e.message);
        });
      }

      // Replace the video track in the peer connection
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else if (pcRef.current) {
        pcRef.current.addTrack(screenTrack, combinedStream);
      }

      // Handle when screen sharing is stopped by the user
      screenTrack.onended = async () => {
        await stopScreenShare();
      };

      setIsScreenSharing(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        addError('Screen sharing failed: ' + err.message);
      }
      setIsScreenSharing(false);
      await restoreCameraAfterScreenShare();
    }
  };

  const restoreCameraAfterScreenShare = async () => {
    if (!mediaStatus.video) return;

    try {
      let localStream;
      
      // Try to reuse the original video track if available
      if (originalVideoTrackRef.current) {
        localStream = new MediaStream();
        localStream.addTrack(originalVideoTrackRef.current);
        
        // Add audio if available
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            localStream.addTrack(audioTrack);
          }
        }
      } else {
        // Get new media if no original track available
        localStream = await getUserMediaWithTimeout({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: mediaStatus.audio
        });
      }

      localStreamRef.current = localStream;

      // Update local video display
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(e => {
          addError('Could not play video after screen share: ' + e.message);
        });
      }

      // Replace the video track in the peer connection
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      originalVideoTrackRef.current = null;
    } catch (err) {
      addError('Could not restore camera: ' + err.message);
    }
  };

  const stopScreenShare = async () => {
    if (!isScreenSharing) return;
    
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      await restoreCameraAfterScreenShare();
      setIsScreenSharing(false);
    } catch (err) {
      addError('Could not stop screen share properly: ' + err.message);
      setIsScreenSharing(false);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleRemoteAudio = () => {
    const newAudioState = !remotePermissions.audio;
    socket.emit('updateRemotePermissions', { 
      meetingId, 
      userId, 
      permissions: { audio: newAudioState, video: remotePermissions.video } 
    });
    setRemotePermissions(prev => ({ ...prev, audio: newAudioState }));
  };

  const toggleRemoteVideo = () => {
    const newVideoState = !remotePermissions.video;
    socket.emit('updateRemotePermissions', { 
      meetingId, 
      userId, 
      permissions: { audio: remotePermissions.audio, video: newVideoState } 
    });
    setRemotePermissions(prev => ({ ...prev, video: newVideoState }));
  };

  const toggleFullscreen = (type) => {
    const videoElement = type === 'local' ? localVideoRef.current : remoteVideoRef.current;
    if (!videoElement) return;

    if (fullscreenVideo === type) {
      document.exitFullscreen().catch(e => {
        addError('Could not exit fullscreen: ' + e.message);
      });
      setFullscreenVideo(null);
    } else {
      videoElement.parentElement.requestFullscreen().catch(e => {
        addError('Could not enter fullscreen: ' + e.message);
      });
      setFullscreenVideo(type);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreenVideo(null);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="p-5 h-screen flex flex-col">
      {/* Error messages display */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {errorMessages.map((msg, index) => (
          <div key={index} className="bg-red-500 text-white px-4 py-2 rounded shadow-lg">
            {msg}
          </div>
        ))}
      </div>

      {!meetingId ? (
        <div className="flex justify-center items-center h-full">
          <button 
            onClick={createMeeting} 
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-medium"
          >
            Create Meeting
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-2xl mb-4">Meeting ID: {meetingId}</h2>
          <div className="flex-1 flex gap-5">
            {/* Local Video */}
            <div className="relative flex-1">
              <h3 className="text-xl mb-2">Your Video</h3>
              <div className={`relative ${fullscreenVideo && fullscreenVideo !== 'local' ? 'hidden' : 'block'}`}>
                {(mediaStatus.video || isScreenSharing) ? (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className={`w-full ${fullscreenVideo === 'local' ? 'h-full' : 'h-72'} rounded-lg bg-black border-2 border-blue-500`} 
                  />
                ) : (
                  <div className="w-full h-72 rounded-lg bg-gray-800 border-2 border-blue-500 flex items-center justify-center text-white">
                    Local Video Unavailable
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex gap-2">
                  {mediaStatus.audio && (
                    <button
                      onClick={toggleMute}
                      className={`px-3 py-1 rounded text-white ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                    >
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>
                  )}
                  {mediaStatus.video && !isScreenSharing && (
                    <button
                      onClick={toggleVideo}
                      className={`px-3 py-1 rounded text-white ${isVideoOn ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                    >
                      {isVideoOn ? 'Video On' : 'Video Off'}
                    </button>
                  )}
                  <button
                    onClick={startScreenShare}
                    className={`px-3 py-1 rounded text-white ${isScreenSharing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                  >
                    {isScreenSharing ? 'Stop Share' : 'Share Screen'}
                  </button>
                  {(mediaStatus.video || isScreenSharing) && (
                    <button
                      onClick={() => toggleFullscreen('local')}
                      className="px-3 py-1 rounded text-white bg-purple-500 hover:bg-purple-600"
                    >
                      {fullscreenVideo === 'local' ? 'Exit Full' : 'Fullscreen'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Remote Video */}
            <div className="relative flex-1">
              <h3 className="text-xl mb-2">Remote Video</h3>
              <div className={`relative ${fullscreenVideo && fullscreenVideo !== 'remote' ? 'hidden' : 'block'}`}>
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className={`w-full ${fullscreenVideo === 'remote' ? 'h-full' : 'h-72'} rounded-lg bg-black border-2 border-green-500`} 
                />
                <div className="absolute bottom-2 left-2 flex gap-2">
                  <button
                    onClick={toggleRemoteAudio}
                    className={`px-3 py-1 rounded text-white ${remotePermissions.audio ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                  >
                    {remotePermissions.audio ? 'Remote Audio On' : 'Remote Audio Off'}
                  </button>
                  <button
                    onClick={toggleRemoteVideo}
                    className={`px-3 py-1 rounded text-white ${remotePermissions.video ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                  >
                    {remotePermissions.video ? 'Remote Video On' : 'Remote Video Off'}
                  </button>
                  <button
                    onClick={() => toggleFullscreen('remote')}
                    className="px-3 py-1 rounded text-white bg-purple-500 hover:bg-purple-600"
                  >
                    {fullscreenVideo === 'remote' ? 'Exit Full' : 'Fullscreen'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-center">
            <button 
              onClick={endMeeting} 
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-lg font-medium"
            >
              End Meeting
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoCallMeeting;