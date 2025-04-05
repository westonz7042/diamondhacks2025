require("dotenv").config();
const fs = require("fs");
const API_KEY = process.env.API_KEY;
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
const inputText = `Despite throwing a wild card at BDS, Rogue’s plans were thwarted during the first weekend of the League of Legends EMEA Championship (LEC) Spring Season. With another tough start, the team now faces the challenge of proving its critics wrong and avoiding the mistakes of recent splits, having finished in 9th or 10th place in the last four. In an exclusive interview with Sheep Esports, midlaner and captain Emil "Larssen" Larsson discusses the team’s cold streak, areas for improvement, his grind to Challenger, and his relationship with social media and critics.

Rogue went 0-2 this week, losing to Heretics and BDS. How are you feeling after this first week back in the LEC?
Emil "Larssen" Larsson: "Yeah, I feel really shit. A 0-2 week in this format, where only the top 6 go through, against bottom-tier opponents, it's not good enough. It's just bad. We can't go 0-2 in the first week against teams like this. So, I'm just really frustrated.


What have you guys been working on in the off-season, and how are you planning to improve as a team?
Larssen: The biggest thing from winter is that we had a lot of leads or games that were even, but we just played the mid-game poorly. It was often macro decisions or individual mistakes. So, the mid-game is something we focused on, because when we get leads, you can see it. Today, we should've won against BDS; I’m not sure about the gold, but I felt like we were winning confidently. Sadly, it’s still our issue. We had a 7k gold lead against Heretics and we managed to lose. We're working on it, but it's still not good enough.

As the captain and a leading figure of the team, how have you been handling the responsibility of keeping morale up, especially given the struggles the team has had since the start of the year?
Larssen: I've been trying hard, especially for spring. Since we had a very tough winter, I've been trying really hard to talk more with the guys, be more socially active, and be more involved in scrims, talking, and leading the game. That's what I'm trying to do. We’ve definitely been playing better in scrims. We’ve been winning more scrims than we did before, so it’s definitely been better. It’s still a little too weak, though, and it’s just really frustrating.

Given the team's struggles, what do you think is a realistic expectation for Rogue right now, and what are you hoping to achieve in spring or even summer? What's the optimal ceiling for the team?
Larssen: I'm always aiming for Worlds. Obviously, that seems a bit unrealistic right now with the way we’re playing, but I’ll always aim for Worlds because that’s where I want to be; it's been a while. But right now, we just need to win games in LEC. There’s not a bigger goal we can look at for now. We just need to win games in LEC. Next week, I think we have to go 2-0. That’s the only goal right now—just to win some games next week.

Next week, you'll be facing Vitality and GIANTX. GX isn’t looking great right now, while Vitality is a bit stronger. What are your expectations for these matches? Do you think both are winnable?
Larssen: Definitely. I think these first two weeks are extremely important for us because we're playing against opponents from the bottom tier teams. That's why it feels so hard right now. But I think next week is very winnable, and we need to win. It's tough... I'm still replaying that BDS game in my mind right now.

`;
async function generateFlashcards(text) {
  const prompt = `
    Based on the following material, create a set of flashcards in this format:
  
    Question: ...
    Answer: ...
  
    Try to keep answers concise, and generate between 5 to 10 cards.
  
    Text:
    ${text}
    `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error("API Error:", data.error.message);
    return [];
  }

  const output = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  console.log("📚 Raw Flashcards:\n", output);

  return parseFlashcards(output);
}

function parseFlashcards(text) {
  const flashcards = [];
  const lines = text.split("\n");

  let question = "";
  let answer = "";

  for (let line of lines) {
    if (line.toLowerCase().startsWith("question:")) {
      question = line.replace(/^question:\s*/i, "").trim();
    } else if (line.toLowerCase().startsWith("answer:")) {
      answer = line.replace(/^answer:\s*/i, "").trim();
      if (question && answer) {
        flashcards.push({ question, answer });
        question = "";
        answer = "";
      }
    }
  }

  return flashcards;
}

function exportFlashcardsToCSV(flashcards) {
  const rows = flashcards.map((card) => `"${card.question}","${card.answer}"`);
  return rows.join("\n");
}

(async () => {
  const flashcards = await generateFlashcards(inputText);
  const csv = exportFlashcardsToCSV(flashcards);

  fs.writeFileSync("flashcards.csv", csv);
  console.log("✅ Flashcards saved to flashcards.csv");
})();
