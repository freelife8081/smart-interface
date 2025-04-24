let provider, signer, contract;

document.getElementById("connectWallet").onclick = async () => {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    const address = await signer.getAddress();
    document.getElementById("walletAddress").innerText = `Connected: ${address}`;
  } else {
    alert("Please install MetaMask");
  }
};

async function loadContract() {
  const abiInput = document.getElementById("abiInput").value;
  const contractAddress = document.getElementById("contractAddressInput").value;
  try {
    const abi = JSON.parse(abiInput);
    contract = new ethers.Contract(contractAddress, abi, signer);
    displayFunctions(abi);
  } catch (err) {
    alert("Invalid ABI or address");
  }
}

function displayFunctions(abi) {
  const container = document.getElementById("functionsContainer");
  container.innerHTML = "";

  abi.filter(item => item.type === "function").forEach(fn => {
    const box = document.createElement("div");
    box.className = "function-box";
    const title = document.createElement("h3");
    title.innerText = fn.name;
    box.appendChild(title);

    fn.inputs.forEach((input, i) => {
      const inputElem = document.createElement("input");
      inputElem.placeholder = `${input.name || 'param'} (${input.type})`;
      inputElem.dataset.index = i;
      inputElem.dataset.name = input.name;
      inputElem.dataset.type = input.type;
      box.appendChild(inputElem);
    });

    const btn = document.createElement("button");
    btn.innerText = `Call ${fn.name}`;
    btn.onclick = async () => {
      const inputs = Array.from(box.querySelectorAll("input")).map(inp => {
        return convertType(inp.value, inp.dataset.type);
      });

      try {
        const result = await contract[fn.name](...inputs);
        const isWrite = fn.stateMutability !== "view" && fn.stateMutability !== "pure";
        document.getElementById("status").innerText = isWrite ? "Transaction sent!" : `Output: ${result}`;
        if (isWrite) await result.wait();
      } catch (err) {
        document.getElementById("status").innerText = `Error: ${err.message}`;
      }
    };

    box.appendChild(btn);
    container.appendChild(box);
  });
}

function convertType(value, type) {
  if (type.includes("uint") || type.includes("int")) {
    return ethers.BigNumber.from(value);
  }
  if (type === "address") {
    return value.toLowerCase();
  }
  if (type === "bool") {
    return value.toLowerCase() === "true";
  }
  return value;
}
