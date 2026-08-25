const Speech = (() => {

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function startListening({ onResult, onError }) {
    if (!isSupported()) {
      if (onError) onError("not-supported");
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const mimeType = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ].find(t => MediaRecorder.isTypeSupported(t)) || "";

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        const chunks = [];

        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());

          const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
          const formData = new FormData();
          formData.append("audio", blob, "answer.webm");

          try {
            const res = await fetch("/transcribe", {
              method: "POST",
              body: formData,
            });
            const data = await res.json();
            if (data.error) {
              if (onError) onError(data.error);
            } else {
              if (onResult) onResult(data.transcript);
            }
          } catch (err) {
            if (onError) onError("network");
          }
        };

        recorder.onerror = () => {
          stream.getTracks().forEach(t => t.stop());
          if (onError) onError("recorder-error");
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 8000);

        Speech._currentRecorder = recorder;
      })
      .catch(err => {
        if (err.name === "NotAllowedError") {
          if (onError) onError("not-allowed");
        } else {
          if (onError) onError("mic-error");
        }
      });
  }

  function stopListening() {
    if (Speech._currentRecorder && Speech._currentRecorder.state === "recording") {
      Speech._currentRecorder.stop();
    }
  }

  return { isSupported, startListening, stopListening };
})();