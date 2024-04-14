const PullServiceClient = require("./pullServiceClient");
const {Web3} = require('web3');

async function main() {
    const address = 'testnet-dora.supraoracles.com'; // Set the gRPC server address
    const pairIndexes = [0, 1, 2, 5]; // Set the pair indexes as an array (supra docstan bu ciftlerin numaralarina bakabilirsin)
    const chainType = 'evm'; // Set the chain type (evm, sui, aptos)

    const client = new PullServiceClient(address);

    const request = {
        pair_indexes: pairIndexes,
        chain_type: chainType
    };
    console.log("Requesting proof for price index : ", request.pair_indexes);
    client.getProof(request, (err, response) => {
        if (err) {
            console.error('Error:', err.details);
            return;
        }
        console.log("Calling contract to verify the proofs.. ");
        callContract(response.evm)
    });
}

async function callContract(response) {

    const web3 = new Web3(new Web3.providers.HttpProvider('https://ethereum-sepolia-rpc.publicnode.com')); // Rpc url for desired chain

    const contractAbi = require("../../resources/abi.json"); // Path of your smart contract ABI

    const contractAddress = '0xA83544BA17b3BEA10b60b10Ed43703b26533C658'; // Address of your smart contract (sc adresi)

    const contract = new web3.eth.Contract(contractAbi, contractAddress);

    const hex = web3.utils.bytesToHex(response.proof_bytes);

    /////////////////////////////////////////////////// Utility code to deserialise the oracle proof bytes (Optional) ///////////////////////////////////////////////////////////////////

    const OracleProofABI = require("../../resources/oracleProof..json"); // Interface for the Oracle Proof data

    const SignedCoherentClusterABI = require("../../resources/signedCoherentCluster.json");  // Interface for the Signed pair cluster data

    let proof_data = web3.eth.abi.decodeParameters(OracleProofABI,hex); // Deserialising the Oracle Proof data 

    let clusters = proof_data[0].clustersRaw; // Fatching the raw bytes of the signed pair cluster data
    let pairMask = proof_data[0].pairMask; // Fetching which pair ids is been requested
    let pair = 0;  // Helps in iterating the vector of pair masking
    let pairId = []  // list of all the pair ids requested
    let pairPrice = []; // list of prices for the corresponding pair ids  
    let pairDecimal = []; // list of pair decimals for the corresponding pair ids
    let pairTimestamp = []; // list of pair last updated timestamp for the corresponding pair ids


    for (let i = 0; i < clusters.length; ++i) {


      let scc = web3.eth.abi.decodeParameters(SignedCoherentClusterABI,clusters[i]); // deserialising the raw bytes of the signed pair cluster data
      
      for (let j = 0; j < scc[0].cc.pair.length; ++j) {
          pair += 1;
          if (!pairMask[pair - 1]) { // verifying whether the pair is requested or not
              continue;
          }
          pairId.push(scc[0].cc.pair[j].toString(10)); // pushing the pair ids requested in the output vector

          pairPrice.push(scc[0].cc.prices[j].toString(10)); // pushing the pair price for the corresponding ids 

          pairDecimal.push(scc[0].cc.decimals[j].toString(10)); // pushing the pair decimals for the corresponding ids requested

          pairTimestamp.push(scc[0].cc.timestamp[j].toString(10)); // pushing the pair timestamp for the corresponding ids requested


      }
    }

    console.log("Pair index : ", pairId);
    console.log("Pair Price : ", pairPrice);
	
	// Fiyatlari 18 ondaliktan USD formatina cevirir.
	const priceInUSD = pairPrice.map(priceString => {
	const price = parseFloat(priceString);
	const decimal = parseInt(pairDecimal[pairPrice.indexOf(priceString)]);
	return (price / (10**decimal)).toFixed(2);
	});
	console.log("Pair Price in USD: ", priceInUSD);
	
	
    console.log("Pair Decimal : ", pairDecimal);
    console.log("Pair Timestamp : ", pairTimestamp);


    /////////////////////////////////////////////////// End of the utility code to deserialise the oracle proof bytes (Optional) ////////////////////////////////////////////////////////////////
    
    const txData = contract.methods.GetPairPrice(hex, 0).encodeABI(); // function from you contract eg:GetPairPrice from example-contract.sol
    const gasEstimate = await contract.methods.GetPairPrice(hex, 0).estimateGas({from: "0xA83544BA17b3BEA10b60b10Ed43703b26533C658"}); // gas icin adres

    // Create the transaction object
    const transactionObject = {
        from: "0xA83544BA17b3BEA10b60b10Ed43703b26533C658", //buraya txi gonderecek olan adres
        to: contractAddress,
        data: txData,
        gas: gasEstimate,
        gasPrice: await web3.eth.getGasPrice() // Set your desired gas price here, e.g: web3.utils.toWei('1000', 'gwei')
    };

    // Sign the transaction with the private key
    const signedTransaction = await web3.eth.accounts.signTransaction(transactionObject, "BURAYA PRIVATE KEY"); //txi imzalayacak olan adresin private keyi

    // Send the signed transaction
    const receipt = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);
    console.log('Transaction receipt:', receipt);
}

main();