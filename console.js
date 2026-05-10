(async () => {
  try {

    // =====================================
    // GET BATTLE ID
    // =====================================

    const fullId = window.location.pathname.split('/battle/')[1];
    const druto_id = fullId.split('-')[0];

    console.log("Battle ID:", druto_id);

    // =====================================
    // FETCH ANSWERS
    // =====================================

    const response = await fetch(
      "https://mujib.chorcha.net/battle/exam-config",
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          druto_id
        })
      }
    );

    const result = await response.json();

    const questions = result?.data?.questions || [];

    // =====================================
    // CREATE ANSWER SOURCE
    // =====================================

    const source = {};

    questions.forEach((q, index) => {
      source[index + 1] = q.answer;
    });

    console.log("Answers:", source);

    // =====================================
    // BUTTON MAP
    // =====================================

    const buttonMap = {
      A: 0,
      B: 1,
      C: 2,
      D: 3
    };

    // =====================================
    // AUTO CLICK
    // =====================================

    let current = 1;
    let waitingForTransition = false;

    console.log("Auto click started...");

    // Run every 1 second instead of 10s for better responsiveness
    const interval = setInterval(() => {

      if (!source[current]) {
        clearInterval(interval);
        console.log("Completed!");
        return;
      }

      const isTransitioning = document.body.innerText.includes('পরবর্তী প্রশ্নে যাওয়া হচ্ছে');
      
      if (isTransitioning) {
        // We are currently transitioning, so reset the waiting flag
        waitingForTransition = false;
        return;
      }

      if (waitingForTransition) {
        // We already clicked and are waiting for the transition text to appear
        return;
      }

      const answer = source[current];
      const buttonIndex = buttonMap[answer];

      // =====================================
      // FIND ONLY QUESTION OPTION BUTTONS
      // =====================================

      const buttons = [
        ...document.querySelectorAll(
          'button.custom-scrollbar, button.flex.w-full.custom-scrollbar'
        )
      ].filter(btn => {
        return btn.innerText.trim() !== "";
      });

      console.log("Detected buttons:", buttons.length);

      if (buttons.length >= 4) {

        const targetButton = buttons[buttonIndex];

        if (targetButton) {

          // REAL CLICK
          targetButton.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window
            })
          );

          console.log(
            `Q${current}: ${answer} -> clicked button ${buttonIndex + 1}`
          );

          current++;
          waitingForTransition = true; // Wait for the transition to start

        } else {

          console.log(`Button ${buttonIndex + 1} not found`);

        }

      } else {

        console.log("Question buttons not found");

      }

    }, 1000);

  } catch (err) {
    console.error(err);
  }
})();