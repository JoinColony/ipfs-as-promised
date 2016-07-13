/* eslint-env node */
import ipfsApi from 'ipfs-api';
import isIPFS from 'is-ipfs';
import { Buffer } from 'buffer';
//This is used to add the EJSON object if Meteor isn't in use
//They're exactly the same. Working out how to remove this line
//(which is only really here because of the tests for the IPFS
//commenting stuff) should be a TODO.
import EJSON from 'ejson';

//Most of this is taken from https://github.com/AkashaProject/meteor-ipfs/blob/master/lib/ipfsServerMethods.js
//but rewritten to use promises rather than fibers and to let us extend it.
//
//NB the license for the above code was the MPL, so we probably have to make just this file available.
//Why not just fork the module? I'm not a fan of the overhead that the module has for downloading IPFS
//itself and installing it. We also want this code available on both the server and locally (for the local IPFS
//node option)
//
//It is likely that writing our own module is the easiest way to meet the MPL though, but for now, it's going
//to be here.


class IpfsClient {
  constructor () {
    let ipfsAddress = '127.0.0.1';
    let ipfsPort = '5001';
    //We will eventually let users use their own IPFS node via this code,
    //and process.env doesn't exist clientside, so only look for environment
    //variables if we're serverside. Will need to be fed parameters as part of
    //this constructor on the clientside, I imagine.
    if (Meteor.isServer){
      if (process.env.IPFS_ADDRESS){
        ipfsAddress = process.env.IPFS_ADDRESS;
      }
      if (process.env.IPFS_PORT){
        ipfsPort = process.env.IPFS_PORT;
      }
    }
    const _IPFS_ADDRESS_ = '/ip4/' + ipfsAddress + '/tcp/' + ipfsPort;
    this._ipfsApi = ipfsApi(_IPFS_ADDRESS_);
  }
  ipfsCat (hash) {
    return new Promise((resolve, reject) => {
      let currentChunk = new Buffer(0);
      this._ipfsApi.cat(hash, function (err, data) {
        if (err) {
          return reject(err);
        }
        if (data && data.readable) {
          data.on('data', function (chunk) {
            //If we execute on the server, chunk is a buffer
            //If we execute on the client, chunk is a string
            //We can't Buffer.concat strings
            //A cookie for anyone who can work out what's happening here
            //Unfortunately, it might be because of meteor-node-stubs which would be
            //quite the knot to untangle.
            if (typeof chunk === 'string') {
              chunk = new Buffer(chunk);
            }
            currentChunk = Buffer.concat([currentChunk, chunk]);
          });
          data.on('end', function () {
            resolve(currentChunk.toString());
          });
          data.on('error', function (err) {
            reject(err);
          });
        }
      });
    });
  }
  ipfsAdd (content) {
    if (EJSON.isBinary(content) && content.buffer) {
      content = new Buffer(new Uint8Array(content.buffer));
    } else {
      content = new Buffer(content);
    }
    return new Promise((resolve, reject) => {
      this._ipfsApi.add(content, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data[0].Hash);
        }
      });
    });
  }
  ipnsPublish (hash) {
    this._ipnsTarget = '/ipfs/' + hash;
    new Promise((resolve, reject) => {
      this._ipfsApi.name.publish(hash, function (err, data) {
        if (err) {
          reject(new Error(err.Message));
        } else {
          resolve(data);
        }
      });
    });
  }
  ipfsPatchAddLink (root, name, ref) {
    return new Promise((resolve, reject) => {
      this._ipfsApi.object.patch.addLink(root, name, ref, function (err, data) {
        if (err) {
          reject(new Error(err.Message));
        } else {
          resolve(data.Hash);
        }
      });
    });
  }
  ipfsPatchRmLink (root, link) {
    return new Promise((resolve, reject) => {
      this._ipfsApi.object.patch.rmLink(root, link, function (err, data) {
        if (err) {
          reject(new Error(err.Message));
        } else {
          resolve(data.Hash);
        }
      });
    });
  }
  async ipfsls (path) {
    var ipfsid = await this.ipfsid();
    if (path.startsWith('/ipns/' + ipfsid)){
      if (this._ipnsTarget) {
        path = path.replace('/ipns/' + ipfsid, this._ipnsTarget);
      } else {
        console.log('nocache! but we need one!');
        this.ipfsNameResolve('/ipns/'+ipfsid);
      }
    }
    return new Promise((resolve, reject) => {
      this._ipfsApi.ls(path, function (err, data) {
        if (err) {
          reject(new Error(err.Message));
        } else {
          resolve(data);
        }
      });
    });
  }
  /**
   * Resolve an IPNS name to an IPFS hash
   * @method ipfsNameResolve
   * @param  {string}        name IPNS name
   * @return {string}             IPFS hash
   */
  async ipfsNameResolve (name) {
    var ipfsid = await this.ipfsid();
    if (name.startsWith('/ipns/' + ipfsid) && this._ipnsTarget){
      name = name.replace('/ipns/' + ipfsid, this._ipnsTarget);
      return {Path: name};
    }
    return new Promise((resolve, reject) => {
      this._ipfsApi.name.resolve(name, (err, data) => {
        if (err) {
          reject(new Error(err.Message));
        } else {
          if (name === '/ipns/'+ipfsid){
            this._ipnsTarget = data.Path;
          }
          resolve(data);
        }
      });
    });
  }
  ipfsid () {
    return new Promise((resolve, reject) => {
      this._ipfsApi.id(function (err, data) {
        if (err) {
          reject(new Error(err.Message));
        } else {
          resolve(data.ID);
        }
      });
    });
  }
  /**
   * Takes an IPFS/IPNS path and returns an object hash
   * @method
   * @param  {string} path IPNS/IPFS path
   * @return {string}      Hash of that object
   */
  async resolvePath (path) {
    //IPFS resolve doesn't exist in the api, so let's roll our own
    //https://github.com/ipfs/js-ipfs-api/issues/174

    if (!isIPFS.path(path)) {
      throw new Error('Not an ipfs path');
    }
    //strip off the last slash if it exists
    if (path.slice(-1) === '/') {
      path = path.slice(0, path.length - 1);
    }
    //If the path is /ipns/, then resolve it
    if (path.slice(0, 6) === '/ipns/') {
      const resolved = await this.ipfsNameResolve(path);
      path = resolved.Path;
    }

    //If the path is /ipfs/address, then just return that hash
    if ((path.match(/\//g) || []).length === 2 && path.slice(0, 6) === '/ipfs/') {
      // Yeah, good luck future reader of code.
      // Okay, I'll explain:
      // First regex counts the number of /s, and || [] means we always get an array
      // if there's nothing, which there shouldn't be, but... *shrug*
      return path.slice(6); //Return everything after /ipfs/
    } else {
      //List the parent object's contents
      const res = await this.ipfsls(path.slice(0, path.lastIndexOf('/')));
      //Get the object with the appropriate name
      return res.Objects[0].Links.filter(function (element) {
        return (element.Name === path.slice(path.lastIndexOf('/') + 1));
      })[0].Hash;
    }
  }
}

// This is bad. It somehow has to be a singleton which is shared between all files.
// It would be great to be able to spawn multiple clients (with maybe different addresses);
export default new IpfsClient();
