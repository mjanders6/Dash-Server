const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(require("cors")());

// Utility functions
const executeCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) return reject(stderr || error.message);
      resolve(stdout.trim());
    });
  });
};

// Add user
app.post("/api/users", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Username and password are required.");
  
  try {
    await executeCommand(`sudo useradd -m ${username} -s /bin/bash`);
    await executeCommand(`echo "${username}:${password}" | sudo chpasswd`);
    res.status(201).send({ message: `User ${username} added successfully.` });
  } catch (error) {
    res.status(500).send({ error });
  }
});

// Remove user
app.delete("/api/users/:username", async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).send("Username is required.");
  
  try {
    await executeCommand(`sudo deluser --remove-home ${username}`);
    res.status(200).send({ message: `User ${username} removed successfully.` });
  } catch (error) {
    res.status(500).send({ error });
  }
});

// Update user password
app.put("/api/users/:username", async (req, res) => {
  const { username } = req.params;
  const { password } = req.body;
  if (!password) return res.status(400).send("Password is required.");
  
  try {
    await executeCommand(`echo "${username}:${password}" | sudo chpasswd`);
    res.status(200).send({ message: `Password for ${username} updated successfully.` });
  } catch (error) {
    res.status(500).send({ error });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const output = await executeCommand("cat /etc/passwd");
    const users = output
      .split("\n")
      .map((line) => line.split(":")[0]) // Extract usernames
      .filter((username) => !username.startsWith("#")) // Exclude comments
      .filter((username) => username.length > 0); // Remove empty lines

    res.status(200).send(users);
  } catch (error) {
    res.status(500).send({ error: "Failed to retrieve users." });
  }
});

// Get a specific user's details
app.get("/api/users/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const output = await executeCommand(`getent passwd ${username}`);
    if (!output) {
      return res.status(404).send({ error: `User ${username} not found.` });
    }

    // Parse the user details from the output
    const [user, x, uid, gid, comment, home, shell] = output.split(":");

    res.status(200).send({
      username: user,
      uid: parseInt(uid, 10),
      gid: parseInt(gid, 10),
      comment,
      home,
      shell,
    });
  } catch (error) {
    res.status(500).send({ error: "Failed to retrieve user details." });
  } 
});

// Get IPs currently being used on the network
app.get("/api/network/ips", async (req, res) => {
  try {
    const subnet = "192.168.1"; // Replace with your subnet
    const promises = [];

    // Ping all IPs in the subnet
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      promises.push(
        executeCommand(`ping -c 1 -W 1 ${ip}`)
          .then(() => ip)
          .catch(() => null) // Ignore unreachable IPs
      );
    }

    const results = await Promise.all(promises);
    const ips = results.filter(ip => ip !== null); // Filter reachable IPs

    res.status(200).send({ ips });
  } catch (error) {
    res.status(500).send({ error: "Failed to retrieve network IPs." });
  }
});

// Get IPs currently being used on the network
app.get("/api/network/nmap-ips", async (req, res) => {
  try {
    // Replace with your network's subnet range (e.g., 192.168.1.0/24)
    const subnet = "192.168.1.0/24";

    // Use `nmap` to perform a network scan
    const output = await executeCommand(`sudo nmap -sn ${subnet}`);
    
    // Parse the `nmap` output to extract IP addresses
    const ips = output
      .split("\n")
      .filter(line => line.includes("Nmap scan report for"))
      .map(line => {
        const parts = line.split(" ");
        return parts[4]; // Extract IP address from the line
      });

    // Send the list of IPs as JSON
    res.status(200).send({ ips });
  } catch (error) {
    console.error("Error retrieving network IPs:", error);
    res.status(500).send({ error: "Failed to retrieve network IPs." });
  }
});




// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
