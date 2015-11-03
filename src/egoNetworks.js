d3.egoNetworks = function module() {
  var attrs = {
    width: 600,
    height:600,
    egoIndex:0,
    nodeKey:'user_id',
    degreeMin:1,
    degreeMax:10,
    valueKey:'value', //null 이면 갯수로 센다.
    sortKey:'value', // sortKey가 ordinal 인지 linear 인지
    sortType:'number',
    nameKey:'ent_name',
    sortAscending : false,
    sortUnit : 1,
    isDirected : false,
    hierKeys : ['team', 'company'],
    colorKey : ['company']
  }
  var margin = {top:40, right:40, bottom:40, left:40}
  var debug = false, sorted = false, durationUnit = 400;
  var size = d3.scale.linear(), color = d3.scale.category20();
  var innerWidth, innerHeight, netRadius, minRadius, maxRadius;
  var sortRadius = d3.scale.ordinal();
  var nodeAndLink;
  var svg;

  Math.radians = function(degrees) {
    return degrees * Math.PI / 180;
  };
  Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
  };
  Math.TWO_PI = Math.PI*2;
  Math.HALF_PI = Math.PI*.5;

  var exports = function (_selection) {
    _selection.each(function(_data) {
      if(!svg) {
        linkAndNode = _data;
        d3.select(this).style('width', attrs.width + 'px')
          .style('height', attrs.height + 'px')
        innerWidth = attrs.width - margin.left - margin.right;
        innerHeight = attrs.height - margin.top - margin.bottom;
        netRadius = innerWidth*.5*.75;
        maxRadius = innerWidth*.5*.90;
        minRadius = innerWidth*.5*.45;
        sortRadius.rangeRoundPoints(attrs.sortAscending ? [minRadius, maxRadius] : [maxRadius, minRadius]);
        svg = d3.select(this).append('svg')
          .attr('width', attrs.width)
          .attr('height', attrs.height)
            .append('g')
          .attr('transform', d3.svg.transform().translate([margin.left, margin.top]))

        svg.append('g')
          .attr('class', 'background');
      }
      var colorExtent = d3.set(linkAndNode.nodes.map(function(d){return d[attrs.colorKey]})).values();
      color.domain(colorExtent);
      size.domain([attrs.degreeMin,attrs.degreeMax])
        .rangeRound([innerWidth*.005, innerWidth*.1]);
      svg.datum(linkAndNode)
        .call(netInit)
        .on('click', function() {
          exports.sort();
        })
    })
  }

  function trimValForSort (d) {
    return Math.floor((d.linkToEgo[attrs.sortKey])/attrs.sortUnit) * attrs.sortUnit
  }
  function setSortRadius(egoAndNeighbors) {
    if (attrs.sortType == 'number') {
        var sortExtent = d3.extent(egoAndNeighbors.neighbors, function(d) {return trimValForSort(d);})
        sortRadius.domain(d3.range(sortExtent[0], sortExtent[1]+attrs.sortUnit, attrs.sortUnit))
    } else {
        var domain = [];
        egoAndNeighbors.neighbors.forEach(function(d){
          if (domain.indexOf(d.linkToEgo[attrs.sortKey]) < 0) {
              domain.push(d.linkToEgo[attrs.sortKey]);
          }
        })
        sortRadius.domain(domain);
    }
  }
  function netInit(_selection) {
    _selection.each(function(_data) {
      var selection = d3.select(this);
      var egoAndNeighbors = getEgoAndNeighbors();
      setSortRadius(egoAndNeighbors);
      selection.call(drawNeighbors, egoAndNeighbors.neighbors)
        .call(drawEgo, egoAndNeighbors.ego);
    })
    return _selection;
  }

  function getEgoAndNeighbors(egoIndex) {
    egoIndex = egoIndex || attrs.egoIndex;

    var getNeighbors = function (egoIndex, egoNeighbors) {

      var neighbors = [], links = linkAndNode.links, nodes = linkAndNode.nodes;
      links.forEach(function(l) {
        if (egoIndex === l.source) {
          var neighbor = findNode(nodes, l.target)
          if (neighbor[attrs.nameKey] !== '-') { // 공식 계정은 걸러내기
            if (!egoNeighbors) {
              if (l.is_mutual) l.type = 'mutual'
              else l.type = 'follow'
              var n = {neighbor:neighbor, linkToEgo:l}
              n[attrs.nodeKey] = l.target;
              neighbors.push(n);
            } else {
              var egoNeighbor = findNode(egoNeighbors, neighbor[attrs.nodeKey])
              if (egoNeighbor) neighbors.push({linkToEgo:l, neighbor:egoNeighbor})
            }
          }
        } else if (egoIndex === l.target) {
          var neighbor = findNode(nodes, l.source)
          if (neighbor[attrs.nameKey] !== '-') { // 공식 계정은 걸러내기
            if((attrs.isDirected && !l.is_mutual)) {
                if(!egoNeighbors) {
                  l.type = 'followed_by'
                  var n = {neighbor:neighbor, linkToEgo:l}
                  n[attrs.nodeKey] = l.source;
                  neighbors.push(n)
                } else {
                  var egoNeighbor = findNode(egoNeighbors, neighbor[attrs.nodeKey])
                  if (egoNeighbor) neighbors.push({linkToEgo:l, neighbor:egoNeighbor})
                }
            }
          }
        }
      })
      neighbors = neighbors.sort(function(a,b){return a.neighbor[attrs.colorKey].localeCompare(b.neighbor[attrs.colorKey])});
      return neighbors;
    }
    var egoData = findNode(linkAndNode.nodes, egoIndex)//_data.nodes[attrs.egoIndex]
    var neighborsData = getNeighbors(egoIndex)

    neighborsData.forEach(function(a) {
      a.linkToNeighbors = getNeighbors(a.neighbor[attrs.nodeKey],
        neighborsData.map(function(d){return d.neighbor})).map(function(d){return d.linkToEgo});
    });

    if(attrs.valueKey) {
      egoData.egoDegree = 0;
      neighborsData.forEach(function(n) {
        egoData.egoDegree += n.linkToEgo[attrs.valueKey]
      })
    } else {
      egoData.egoDegree = neighborsData.length;
    }
    return {ego:egoData, neighbors:neighborsData}
  }

  function findNode(nodes, value) {
    for (var i = 0; i < nodes.length ; i++) {
      if (nodes[i][attrs.nodeKey] == value) {
        return nodes[i];
      }
    }
    return null;
  }

  function drawEgo(selection, egoData) {
    var ego = selection.selectAll('.ego')
      .data([egoData], function(d){return d[attrs.nodeKey]})

    var egoEnter = ego.enter().append('g')
      .attr('class', 'ego node');

    egoEnter.append('circle');
    egoEnter.append('text');

    ego.transition().duration(durationUnit)
      .attr('transform', d3.svg.transform()
        .translate([innerWidth/2, innerHeight/2])
      )
    ego.select('circle')
      .transition().duration(durationUnit)
      .attr('r', function(d){console.log(d);return size(d.egoDegree)})

    ego.select('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.45em')
      .attr('transform', null)
      .text(function(d){return d[attrs.nameKey]})
    /*
    ego.exit()
      .classed({'ego':false, 'neighbor':true})
    */
    return selection;
  }

  function drawNeighbors(selection, neighborsData) {
    var thetaUnit = Math.PI*2/ neighborsData.length,
      thetaOffset = thetaUnit *.3

    var background = selection.select('.background')
      .selectAll('.background-circle')
        .data(function(d){
          return sorted ? d3.zip(sortRadius.range(), sortRadius.domain())
            : [[netRadius]]},
          function(d){return d[0]});

    var backgroundEnter = background.enter().append('g')
      .attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
      .attr('class', 'background-circle')
    //zip
    var circle = backgroundEnter.append('circle')
        .attr('r', 0)

      circle.transition().duration(durationUnit)
        .attr('r', function(d){return d[0]})

    if (sorted) {
      var text = background.selectAll('text')
        .data(function(d){return [d]})
      .enter().append('text')
        .attr('text-anchor','end')
        .text(function(d){return d[1]})
        .style('opacity', 0)
        .attr('x', 0)
        .attr('dx', '-.45em')
        .attr('dy', '.35em')

      text.transition().duration(durationUnit)
        .style('opacity', 1)
        .attr('x', function(d){return d[0]})

    } else {
      background.selectAll('text')
        .remove();
    }

    background.transition()
      .duration(durationUnit)
      .attr('r', function(d){return d})

    background.exit().remove();

    var neighborFunc = function(selection, neighbors, callback) {
      selection.each(function(d) {
        if ('linkToNeighbors' in d) {
          d.linkToNeighbors.forEach(function(l) {
            neighbors.filter(function(n) {
              return ((l.source == n[attrs.nodeKey] || l.target == n[attrs.nodeKey])
                && (n[attrs.nodeKey] !== d[attrs.nodeKey]))
            }).each(callback)
          })
        }
      })
    }


    var neighbors = selection.selectAll('.neighbor.main')
      .data(neighborsData, function(d){return d[attrs.nodeKey]})

    var neighborsEnter = neighbors.enter().append('g')
      .attr('class', 'neighbor node main')
      .each(function(d) {d.x = innerWidth*.5; d.y = innerHeight*.5})
      .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))


    neighborsEnter.append('circle');
    neighborsEnter.append('text')

    neighbors.call(setNeighborInteraction)
    .each(function(d,i) {
      d.theta = thetaUnit*i;
    }).call(setNeighborPos)
    .transition().delay(durationUnit*.5).duration(durationUnit)
    .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))

    neighbors.selectAll('circle')
      .data(function(d){return [d]})
      .attr('r', function(d){return attrs.valueKey && d.linkToEgo[attrs.valueKey] ? size(d.linkToEgo[attrs.valueKey]) : 4})
      .style('fill', function(d){return color(d.neighbor[attrs.colorKey]);})

    neighbors.selectAll('text')
      .data(function(d){return [d]})
      .attr('text-anchor', function(d) {
        return (d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ? 'end' : 'start';
      }).attr('transform', d3.svg.transform().rotate(function(d){
        return (d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ?   Math.degrees(d.theta) + 180 : Math.degrees(d.theta);
        }).translate(function(d) {
          var dx = size(attrs.valueKey ? d.linkToEgo : 1) + 2;
          return [(d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ? -dx : dx, 0]
        }))
      .attr('dy', '.35em')
      .text(function(d) {return d.neighbor[attrs.nameKey]})

    var linkRadius = d3.scale.linear()
      .domain([0, Math.HALF_PI])

    var linkLine = d3.svg.line()
      //.interpolate('cardinal')
      //.tension(1)
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; });

    var linkData = []
    neighbors.each(function(d){
      var self = d3.select(this);
      self.call(neighborFunc, neighbors, function(n) {
        // d-n
        var distTheta = (Math.abs(n.theta-d.theta)%(Math.TWO_PI));
        if (distTheta <= Math.HALF_PI) {
          var meanTheta = distTheta*.5 + d.theta;
          if (sorted) {
            var sortValA = d.linkToEgo[attrs.sortKey], sortValB = n.linkToEgo[attrs.sortKey];
            linkRadius.range(
              attrs.sortType === 'number' ? [sortRadius(trimValForSort(sortValA)), sortRadius(trimValForSort(sortValB))] : [sortRadius(sortValA), sortRadius(sortValB)]
            )
          } else {
            linkRadius.range([netRadius*.5, netRadius])
          }
          var r = linkRadius(meanTheta%Math.PI);
          var center = {x: Math.cos(meanTheta)*r + innerWidth*.5
            , y: Math.sin(meanTheta)*r + innerHeight*.5}
          linkData.push([{node:d, x:d.x, y:d.y}, {node:n, x:n.x, y:n.y}])
          //linkData.push([{node:d, x:d.x, y:d.y}, center, {node:n, x:n.x, y:n.y}])
        } else {
          linkData.push([{node:d, x:d.x, y:d.y}, {node:n, x:n.x, y:n.y}])
        }
      });
    })
    neighbors.exit().remove();
    /*
    var link = selection.selectAll('.link')
      .data(linkData, function(d){return d[0].node.neighbor[attrs.nodeKey] + '-' +d[d.length-1].node.neighbor[attrs.nodeKey]})

    link.enter().append('path')
      .attr('class', 'link')

    link.transition().delay(durationUnit*.5).duration(durationUnit)
      .attr('d', linkLine);
    link.exit().remove();
    */
    return selection;
  }

  function drawRestNeighbors(_selection, neighborsData) { // _selection == centerNode;
    var thetaUnit = Math.PI*2/ neighborsData.length,
      thetaOffset = thetaUnit *.3


    var cx = _selection.datum().x, cy= _selection.datum().y;

    var neighbors = svg.selectAll('.neighbor.sub')
      .data(neighborsData, function(d){return d[attrs.nodeKey]})

    var neighborsEnter = neighbors.enter().append('g')
      .attr('class', 'neighbor node sub')

    neighbors.each(function(d,i) {
      d.theta = thetaUnit*i;
    }).call(setNeighborPos, true)
    .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))
    .style('opacity', 0)

    neighborsEnter.append('circle');
    neighborsEnter.append('text');

    neighbors.transition().delay(durationUnit*.5).duration(durationUnit)
      .style('opacity', 1)

    neighbors.selectAll('circle')
      .attr('r', function(d){return (attrs.valueKey && d.linkToEgo[attrs.valueKey] ? size(d.linkToEgo[attrs.valueKey]) : 4)*.75})
      .style('fill', function(d){return color(d.neighbor[attrs.colorKey]);})

    neighbors.selectAll('text')
      .data(function(d){return [d]})
      .attr('text-anchor', function(d) {
        return (d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ? 'end' : 'start';
      }).attr('transform', d3.svg.transform().rotate(function(d){
        return (d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ?   Math.degrees(d.theta) + 180 : Math.degrees(d.theta);
        }).translate(function(d) {
          var dx = size(attrs.valueKey ? d.linkToEgo : 1) + 2;
          return [(d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ? -dx : dx, 0]
        }))
      .attr('dy', '.35em')
      .text(function(d) {return d.neighbor[attrs.nameKey]})

    neighbors.exit().remove();
    return _selection;
  }
  function setNeighborPos(selection,  isRest) {
    var cx = innerWidth*.5, cy =  innerHeight*.5;
    selection.each(function(d) {
      /*
      d3.select(this).call(neighborFunc, neighbors, function(n) {
            if(n.theta - d.theta <= Math.PI) {
              //FIXME : 링크 value를 곱해주기
              d.theta += thetaOffset;
              n.theta -= thetaOffset;
            } else {
              d.theta -= thetaOffset;
              n.theta += thetaOffset;
            }
        });
        */
        var sortVal = d.linkToEgo[attrs.sortKey];
        var radius = (sorted ? sortRadius(attrs.sortType=== 'number'?  trimValForSort(sortVal): sortVal) : netRadius);
        if (isRest) {
          radius = (sorted ? sortRadius.rangeExtent()[1]: netRadius) * 1.25;
        }
        d.x = cx+Math.cos(d.theta)*radius;
        d.y = cy+Math.sin(d.theta)*radius;
    })
    return selection;
  }

  function setNeighborInteraction(_selection) {
    function _isNeighbor(index, linkToNeighbors) {
      for (var i = 0 ; i < linkToNeighbors.length; i++) {
        if (index === linkToNeighbors[i].source
            || index === linkToNeighbors[i].target) {
          return true;
        }
      }
      return false;
    }

    _selection.on('mouseenter.neighbor', function(d){
      d3.select(this).classed({'hover': true})
      var curIndex = d[attrs.nodeKey];
      var linkToNeighbors = d.linkToNeighbors;
      var neighbors = d3.select(d3.select(this).node().parentNode)
        .selectAll('.neighbor.main')
        .filter(function(n) {
          var index = n[attrs.nodeKey];
          if (index !== curIndex) return _isNeighbor(index, linkToNeighbors);
          return false;
        }).classed({'hover':true})

      var egoAndNeighbors = getEgoAndNeighbors(curIndex);
      var restNeighbors = egoAndNeighbors.neighbors.filter(function(n) {
        return !(_isNeighbor(n[attrs.nodeKey], linkToNeighbors))
      })
      //FIXME : 존재하는 친구 제외
      d3.select(this).call(drawRestNeighbors, restNeighbors);
    }).on('mouseleave', function() {
        svg.selectAll('.neighbor.main.hover').classed({'hover': false})
        svg.selectAll('.neighbor.sub')
          .transition().duration(durationUnit)
          .style('opacity', 0)
          .each('end', function() {
            d3.select(this).remove();
          })
    }).on('click.neighbor', function(d) {
      d3.select(this).call(transform);
      d3.event.stopPropagation();
    })
  }

  function transform(_selection) {
    var cur = _selection.datum();
    var egoAndNeighbors = getEgoAndNeighbors(cur[attrs.nodeKey]);
    setSortRadius(egoAndNeighbors);
    attrs.egoIndex = cur[attrs.nodeKey];
    svg.selectAll('.ego')
      .classed({'ego':false, 'neighbor':true, 'main':true})
      .each(function(d){
        var n = egoAndNeighbors.neighbors.filter(function(n){
          return d[attrs.nodeKey] === n[attrs.nodeKey];
        })[0]

        d= {};

        for (var k in n) {
          d[k] = n[k];
        }
      })

    var ego = _selection
      .classed({'ego': true, 'neighbor':false, 'main':false})
      .each(function(d){
        /*
        for (var k in d) {
          if(d.hasOwnProperty(k)) delete d[k]
        }
        */
        d={};
        for (var k in egoAndNeighbors.ego) {
          d[k] = egoAndNeighbors.ego[k];
        }
      })

    svg.selectAll('.neighbor.sub')
      .classed({'sub':false, 'main':true});

    svg.call(drawEgo, egoAndNeighbors.ego)
      .call(drawNeighbors, egoAndNeighbors.neighbors);
    /*
    ego.attr('transform', d3.svg.transform()
      .translate([innerWidth/2, innerHeight/2]))
      .selectAll('circle')
      .attr('r', function(d){console.log(d);return size(d.egoDegree)})

    ego.selectAll('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.45em')
      .text(function(d){return d[attrs.nameKey]})
    */
    /* TODO:
    1. egoAndNeighbor 데이터 구하기
    2. selection-> ego로 변환
    3. .main 필터링
    4. .sub 메인 변환
    5. 자리 잡기
    */
    svg.selectAll('.neighbor.sub')
  }

  function accessor(_attr) {
    return function(value) {
      if(value === undefined) return attrs[_attr]
      attrs[_attr] = value;
      return exports;
    }
  }

  exports['sort'] = function (sortKey) {
    if (sortKey !== undefined) {
      attrs.sortKey = 'sortKey';
    }

    sorted = !sorted;
    svg.call(netInit);
    //sort;
    return exports;
  }


  for (var attr in attrs) {
    if(attrs.hasOwnProperty(attr)) {
      exports[attr] = accessor(attr);
    }
  }

  return exports;
}
